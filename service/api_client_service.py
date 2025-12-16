import httpx
import logging
from typing import Dict, Any, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    retry_if_exception,
    before_sleep_log
)

from constants import NO_CLIENT_ID_IN_BO
from service.exceptions import ExternalAPIError

logger = logging.getLogger(__name__)


class SecureAPIClient:
    FSID_TOKEN: Optional[str] = "73xZT13z7S42eEPcfbvL5ypZ"

    def __init__(
            self,
            base_url: str,
            timeout: int = 10,
            max_retries: int = 3
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries

    async def _get_access_token(self) -> str:
        logger.info("Получение нового fsid")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"https://pari-ud-api.pbcorp.ru/reg_obmen/hs/AuthBO/fsid",
                    json={
                        "auth": "HC6Lty2xqv85KgTYApAV7xXUCPev040y"
                    }
                )

                if response.status_code != 200:
                    raise ExternalAPIError(
                        f"Failed to get token: {response.status_code} {response.text}",
                        response.status_code
                    )

                token_data = response.json()
                SecureAPIClient.FSID_TOKEN = token_data.get("fsid")
                if not SecureAPIClient.FSID_TOKEN:
                    raise ExternalAPIError("Fsid response missing 'fsid'", 500)

                logger.info("Новый fsid успешно получен")
                return SecureAPIClient.FSID_TOKEN

        except Exception as e:
            logger.error(f"Ошибка получения fsid: {e}")
            raise ExternalAPIError(f"Fsid acquisition failed: {str(e)}", 500)


    async def _send_freebet_request(self, client_id: str, email: str) -> dict[str, str]:
        logger.info("Запрос на отправку фрибета")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"https://pari-ud-api.pbcorp.ru/ServiceAPI/hs/OATS/WantFreeBet",
                    json={
                        "clientId": client_id,
                        "email": email
                         }

                )

                if response.status_code != 200:
                    raise ExternalAPIError(
                        f"Failed to send freebet: {response.status_code} {response.text}",
                        response.status_code
                    )

                freebet_data = response.json()

                return freebet_data

        except Exception as e:
            logger.error(f"Ошибка начисления фрибета: {e}")
            raise ExternalAPIError(f"Freebet acquisition failed: {str(e)}", 500)


    def _is_token_expired(self, response_json: Dict[str, Any]) -> bool:
        SESSION_DROPPED_1 = {'kind': 'error', 'response': {'errorCode': 1, 'errorText': 'InternalError',
                                                           'errorValue': 'Внутренняя ошибка сервера, keep session: send request: login required'}}
        SESSION_DROPPED_2 = {'kind': 'error', 'response': {'errorCode': 7, 'errorText': 'SessionNotFound'}}

        return response_json == SESSION_DROPPED_1 or response_json == SESSION_DROPPED_2


    @retry(
        retry=(
                retry_if_exception_type((httpx.RemoteProtocolError, httpx.ConnectTimeout, httpx.NetworkError)) |
                retry_if_exception(lambda e: isinstance(e, TokenExpiredError)) |
                retry_if_exception(lambda e: isinstance(e, ExternalAPIError) and getattr(e, 'status_code', 0) >= 500)
        ),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True
    )
    async def _make_request_with_token(
            self,
            endpoint: str,
            method: str,
            base_payload: Dict[str, Any] | str = None
    ) -> Dict[str, Any]:

        if not SecureAPIClient.FSID_TOKEN:
            SecureAPIClient.FSID_TOKEN = await self._get_access_token()

        # поддержка абсолютных URL
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            url = endpoint
        else:
            url = f"{self.base_url}{endpoint}"

        request_kwargs = {"url": url}

        if method.upper() == "GET":
            if base_payload:
                request_kwargs["params"] = base_payload
        else:
            full_payload = {**base_payload, "fsid": SecureAPIClient.FSID_TOKEN} if base_payload else {
                "fsid": SecureAPIClient.FSID_TOKEN}
            request_kwargs["json"] = full_payload

        try:
            async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=5.0),
                    follow_redirects=True
            ) as client:
                logger.debug(f"Отправка {method.upper()} запроса к {endpoint} с данными: {request_kwargs}")

                response = await client.request(method.upper(), **request_kwargs)

                try:
                    response_json = response.json()
                except ValueError:
                    response_json = {"raw_response": response.text}

                if self._is_token_expired(response_json):
                    logger.warning("Обнаружен истёкший fsid в ответе API")
                    await self._get_access_token()
                    raise TokenExpiredError("Access fsid expired - will retry with new fsid")


                if response.status_code == 200:
                    if response_json["kind"] == "error":
                        if response_json == NO_CLIENT_ID_IN_BO:
                            raise ExternalAPIError(message=f"Введенный игровой счет отсутствует в БО", status_code=400)
                        else:
                            raise ExternalAPIError(message=f"Ошибка запроса {self.base_url}{endpoint} с БО, ответ: {response_json}", status_code=400)
                    return response_json


                error_msg = f"HTTP {response.status_code}: {response_json}"
                logger.error(f"Ошибка API: {error_msg}")
                raise ExternalAPIError(error_msg, response.status_code)

        except httpx.TimeoutException as e:
            raise ExternalAPIError(f"Request timeout: {str(e)}", 408)
        except httpx.NetworkError as e:
            raise ExternalAPIError(f"Network error: {str(e)}", 500)
        except Exception as e:
            if not isinstance(e, (TokenExpiredError, ExternalAPIError)):
                raise ExternalAPIError(f"Unexpected error: {str(e)}", 500)
            raise


    async def find_wager_url_rules_name(
            self,
            user_id: str
    ) -> Dict[str, Any]:

        base_payload = {
                "login": "csat",
                "userId": "9776",
                "userLang": "ru",
                "clientId": user_id,
                "lastVersion": "0"
               }

        logger.info(f"Расчёт бонус-wager-info для user_id={user_id}")
        return await self._make_request_with_token(
            endpoint="/api/bonus/getClientBonusesByVersion",
            method="post",
            base_payload=base_payload
        )


    async def get_free_bet_list(self, client_id: str) -> Dict[str, Any]:

        base_payload = {
                "clientId": client_id,
                "login": "csat",
                "userId": "9776",
                "userLang": "ru"
            }

        logger.info(f"Расчёт freebet_list для user_id={client_id}")
        return await self._make_request_with_token(
            endpoint="/api/backoffice/freebets/getFreebetList",
            method="post",
            base_payload=base_payload
        )


    async def get_deposits_plus_withdrawals(self, client_id):

        base_payload = {
            "clientId": client_id,
            "maxCount": 200,
            "scopeId": "23",
            "login": "csat",
            "userId": "9776",
            "userLang": "ru"
        }

        logger.info(f"Расчёт freebet_list для user_id={client_id}")
        return await self._make_request_with_token(
            endpoint="/api/paygate/client/lastTransactions",
            method="post",
            base_payload=base_payload
        )

    async def get_client_information(self,
                                     client_id: str) -> Dict[str, Any]:
        base_payload = {
            "login": "csat",
            "userId": "9776",
            "userLang": "ru",
            "clientId": client_id
        }

        logger.info(f"Получение информации по клиенту с user_id={client_id}")
        return await self._make_request_with_token(
            endpoint="/api/backoffice/client/information",
            method="post",
            base_payload=base_payload
        )

    async def get_client_actions(self, client_id: str) -> Dict[str, Any]:
        base_payload = {
            "login": "csat",
            "userId": "9776",
            "userLang": "ru",
            "clientId": client_id
        }

        logger.info(f"Получение акций по клиенту с user_id={client_id}")
        return await self._make_request_with_token(
            endpoint="/api/loyalty/getClientLoyaltyParticipationHistory",
            method="post",
            base_payload=base_payload
        )

    async def get_action_clients_progresses(
            self,
            client_id: str,
            action_id: int,
    ) -> Dict[str, Any]:
        base_payload = {
            "actionId": str(action_id),
            "clientIdList": [str(client_id)],
            "login": "csat",
            "userId": "9776",
            "userLang": "ru",
        }

        logger.info(
            f"Получение прогресса по акции action_id={action_id} для client_id={client_id}"
        )

        return await self._make_request_with_token(
            endpoint="/api/loyalty/getActionClientsProgresses",
            method="post",
            base_payload=base_payload,
        )

    async def get_client_segment_entries(self, client_id: str) -> Dict[str, Any]:
        base_payload = {
            "clientIdList": [str(client_id)],
            "login": "csat",
            "userId": "9776",
            "userLang": "ru",
        }
        return await self._make_request_with_token(
            endpoint="/api/segment/getClientSegmentEntries",
            method="post",
            base_payload=base_payload,
        )

    async def add_clients_to_segment(self, client_id: str) -> Dict[str, Any]:
        base_payload = {
            "segmentId": "64353",
            "clientIdList": [str(client_id)],
            "login": "csat",
            "userId": "9776",
            "userLang": "ru",
        }
        logger.info(f"Добавление клиента client_id={client_id} в segment_id=64353")
        return await self._make_request_with_token(
            endpoint="/api/segment/addClientsToSegment",
            method="post",
            base_payload=base_payload,
        )

class TokenExpiredError(Exception):
    pass