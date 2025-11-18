import asyncio
import time
from typing import Any

import asyncpg
import httpx

from config import settings
from constants import EUROBONUS_10, EUROBONUS_30, EUROBONUS_50, EUROBONUS_70, EUROBONUS_100
from service.api_client_service import SecureAPIClient, logger
from service.exceptions import ExternalAPIError


class SorryBonusService:
    def __init__(
            self,
            api_client: SecureAPIClient
    ):
        self.api_client = api_client

    @staticmethod
    def get_start_end_point_interval_2_days():
        end_unix = int(time.time()) * 1000
        start_unix = end_unix - 2 * 24 * 60 * 60 * 1000
        return start_unix, end_unix

    @staticmethod
    def get_last_24_hours_endpoint():
        end_unix = int(time.time()) * 1000
        start_unix = end_unix - (24 * 60 * 60)
        return start_unix


    @staticmethod
    async def get_bonus_by_business_key(business_key: int):
        try:
            conn = await asyncpg.connect(
                user=settings.ORPO_USER,
                password=settings.ORPO_PASS,
                database=settings.ORPO_BD,
                host=settings.ORPO_HOST,
                port=settings.ORPO_PORT
            )

            row = await conn.fetchrow(
                "SELECT bonus FROM support_data.sorry_bonus WHERE business_key = $1",
                business_key
            )

            await conn.close()

            return row["bonus"] if row else None
        except Exception as e:
            print(f"Orpo db exception: {e}")
            await conn.close()

    @staticmethod
    def has_bad_statuses(client_information: dict[str, Any]) -> bool:
        target_codes = {"84", "69", "76", "112", "96", "73", "115"}
        restrictions_1 = ["29", "9992", "9981", "124", "120", "9998", "100000", "9986", "9984", "9991", "105", "9990"]
        restrictions_2 = ["128", "109", "77", "139", "83", "9994", "113", "9997", "102", "9987", "104"]
        for bo_class in client_information["response"]["list"]:
            if bo_class["class"] == "Fon.Client.Extension":
                if bo_class["object"]["manualRestrictions"]:
                    if any(code in restrictions_1 for code in bo_class["object"]["manualRestrictions"]):
                        return True
                elif bo_class["object"]["antifraudRestrictions"]:
                    if any(code in restrictions_2 for code in bo_class["object"]["antifraudRestrictions"]):
                        return True
                    else:
                        if bo_class["object"]["antifraudRestrictions"]:
                            for i, code in enumerate(bo_class["object"]["antifraudRestrictions"]):
                                if code in target_codes and bo_class["object"]["antifraudRestrictionsSports"][i] == "0":
                                    return True
                            return False
                        return False
                return False
        return False


    @staticmethod
    def is_vip(client_information: dict[str, Any]) -> bool:
        for bo_class in client_information["response"]["list"]:
            if bo_class["class"] == "Fon.Antifraud.ClientGrades":
                if bo_class["object"]["gradeRatings"]:
                    for client_rating in bo_class["object"]["gradeRatings"]:
                        if client_rating["object"]["gradeType"] == "8" and client_rating["object"]["manualSubType"] in ["803", "814", "809", "807", "808"]:
                            return True
                        elif client_rating["object"]["gradeType"] == "25" and client_rating["object"]["manualSubType"] == "2502":
                            return True
                    return False
                return False
        return False


    @staticmethod
    def check_for_free_bets(free_bet_data: dict[str, Any]) -> bool:
        free_bet_list = free_bet_data["response"]["list"]
        two_days_ago, now = SorryBonusService.get_start_end_point_interval_2_days()
        valid_free_bets_time = [free_bet for free_bet in free_bet_list if
                                free_bet["object"]["createdTime"] >= two_days_ago and free_bet.get("deleted",
                                                                                                 False) is not True]
        valid_free_bets_second = [free for free in valid_free_bets_time if
                                  free["object"]["restriction"] in ['359', '705']]
        if len(valid_free_bets_second) != 0:
            return True
        return False

    @staticmethod
    def calculate_profit_from_deps_withdrawals(transaction_data: dict[str, Any]):
        transaction_list = transaction_data["response"]
        deposit_sum = sum([dep for dep in transaction_list if dep["type"] == "deposit" and dep["status"] == "SUCCESS" and int(dep["createdAt"]) >= SorryBonusService.get_last_24_hours_endpoint()])
        withdrawal_sum = sum([dep for dep in transaction_list if dep["type"] == "withdrawal" and dep["status"] == "SUCCESS" and int(dep["createdAt"]) >= SorryBonusService.get_last_24_hours_endpoint()])

        return deposit_sum - withdrawal_sum


    @staticmethod
    async def vip_flow_euro_bonus(client_id):
        try:
            api_response = await SorryBonusService.get_data_from_request_to_euro_bonus_api(client_id)
            if api_response.get("description", None):
                return {
                    "has_offer": False,
                    "euro_bonus_answer": api_response["description"]
                }

            elif api_response.get("message_code", None):
                if api_response["message_code"] == 10:
                    return {
                    "has_offer": True,
                    "euro_bonus_answer": EUROBONUS_10
                }

                elif api_response["message_code"] == 30:
                    return {
                    "has_offer": True,
                    "euro_bonus_answer": EUROBONUS_30
                }

                elif api_response["message_code"] == 50:
                    return {
                    "has_offer": True,
                    "euro_bonus_answer": EUROBONUS_50
                }

                elif api_response["message_code"] == 70:
                    return {
                    "has_offer": True,
                    "euro_bonus_answer": EUROBONUS_70
                }

                elif api_response["message_code"] == 100:
                    return {
                    "has_offer": True,
                    "euro_bonus_answer": EUROBONUS_100
                }

            return {"data": "error", "details": api_response}

        except Exception as e:
            return {"data": "error", "details": e}


    async def vip_flow_sorry_bonus(self, client_id: str):
        try:
            freebets = await self.api_client.get_free_bet_list(client_id)
            transactions = await self.api_client.get_deposits_plus_withdrawals(client_id)
            profit = SorryBonusService.calculate_profit_from_deps_withdrawals(transactions)
            if SorryBonusService.check_for_free_bets(freebets):
                return {"client_id": client_id,
                        "bad_state": False,
                        "data":
                        {"have_bonus": False,
                         "reason": "Заявка отклонена, с момента последнего начисленного фрибета прошло менее 2 суток",
                         "dep_sum": profit
                         }}
            else:
                orpo_info = await SorryBonusService.get_bonus_by_business_key(int(client_id))
                if not orpo_info or orpo_info < 50:
                    return {"client_id": client_id,
                             "bad_state": False,
                             "data":
                                 {"have_bonus": False,
                                  "reason": "Фрибет отсутствует",
                                  "dep_sum": profit,
                                  "orpo_bonus": orpo_info
                                  }}

                else:
                    return {"client_id": client_id,
                            "bad_state": False,
                            "data":
                                {"have_bonus": True,
                                 "sum_bn": orpo_info
                                 }}

        except Exception as e:
            return {"data": "error", "details": e}


    async def normal_flow_sorry_bonus(self, client_id: str):
        try:
            freebets = await self.api_client.get_free_bet_list(client_id)


            if SorryBonusService.check_for_free_bets(freebets):
                return {"client_id": client_id,
                        "bad_state": False,
                        "data":
                        {"have_bonus": False,
                         "reason": "Заявка отклонена, с момента последнего начисленного фрибета прошло менее 2 суток"
                         }}
            else:
                orpo_info = await SorryBonusService.get_bonus_by_business_key(int(client_id))

                if not orpo_info or orpo_info < 50:
                    return {"client_id": client_id,
                             "bad_state": False,
                             "data":
                                 {"have_bonus": False,
                                  "reason": "Фрибет отсутствует",
                                  "orpo_bonus": orpo_info
                                  }}

                else:
                    return {"client_id": client_id,
                            "bad_state": False,
                            "data":
                                {"have_bonus": True,
                                 "sum_bn": orpo_info
                                 }}

        except Exception as e:
            return {"data": "error", "details": e}

    @staticmethod
    async def get_data_from_request_to_euro_bonus_api(client_id: str):
        url = "http://192.168.220.66:8010/api/v1/check_euro_bonus"
        data = {"client_id": client_id}
        async with httpx.AsyncClient(
                timeout=httpx.Timeout(timeout=10.0, connect=5.0),
                follow_redirects=True
        ) as client:
            response = await client.post(url=url, json=data)

            try:
                response_json = response.json()
            except ValueError:
                response_json = {"raw_response": response.text}

                error_msg = f"HTTP {response.status_code}: {response_json}"
                logger.error(f"Ошибка API: {error_msg}")
                raise ExternalAPIError(error_msg, response.status_code)

            if response.status_code == 200:
                return response_json

            error_msg = f"HTTP {response.status_code}: {response_json}"
            logger.error(f"Ошибка API: {error_msg}")
            raise ExternalAPIError(error_msg, response.status_code)

    @staticmethod
    def get_client_name(client_information: dict[str, Any]) -> str | None:
        try:
            for bo_class in client_information["response"]["list"]:
                if bo_class["class"] == "Fon.Ora.Client":
                    obj = bo_class.get("object") or {}
                    full_fio = obj.get("fullFIO")

                    fio_parts = full_fio.split()
                    first_name = fio_parts[1] if len(fio_parts) >= 2 else None
                    return first_name

        except Exception as e:
            logger.error(f"Ошибка получения имени клиента: {e}")
        return None

    @staticmethod
    def is_email_provided(client_information: dict[str, Any]) -> bool:
        for bo_class in client_information["response"]["list"]:
            if bo_class["class"] == "Fon.Client.Extension":
                return True if bo_class["object"]["email"] is not None else False
        return False

    @staticmethod
    def is_email_confirmed(client_information: dict[str, Any]) -> bool:
        for bo_class in client_information["response"]["list"]:
            if bo_class["class"] == "Fon.Client.Extension":
                return bo_class["object"]["emailConfirmed"]
        return False

    @staticmethod
    async def get_client_rate(business_key: int) -> str | None:
        try:
            conn = await asyncpg.connect(
                user=settings.ORPO_USER,
                password=settings.ORPO_PASS,
                database=settings.ORPO_BD,
                host=settings.ORPO_HOST,
                port=settings.ORPO_PORT
            )

            row = await conn.fetchrow(
                "SELECT rating FROM support_data.player_rating WHERE business_key = $1",
                business_key
            )

            await conn.close()

            return row["rating"] if row else None
        except Exception as e:
            print(f"Orpo db exception: {e}")
            await conn.close()

    async def get_combined_response_euro_bonus(self, client_id):

        client_information = await self.api_client.get_client_information(client_id=client_id)
        client_first_name = self.get_client_name(client_information)
        is_email_provided = self.is_email_provided(client_information)
        is_email_confirmed = self.is_email_confirmed(client_information)
        client_rate = await SorryBonusService.get_client_rate(int(client_id))

        if SorryBonusService.has_bad_statuses(client_information):
            return {"client_id" : client_id,
                    "client_first_name": client_first_name,
                    "is_email_provided": is_email_provided,
                    "is_email_confimed": is_email_confirmed,
                    "client_rate": client_rate,
                    "bad_state": True,
                    "data":
                        {"have_bonus": False,
                        "reason": "недоступны бонусы!"
                        }
                    }

        if SorryBonusService.is_vip(client_information):
            gather_data = await asyncio.gather(SorryBonusService.vip_flow_euro_bonus(client_id), self.vip_flow_sorry_bonus(client_id))
            return {"client_id": client_id,
                    "client_first_name": client_first_name,
                    "is_email_provided": is_email_provided,
                    "is_email_confimed": is_email_confirmed,
                    "client_rate": client_rate,
                    "client_type": "vip",
                    "euro_bonus": gather_data[0],
                    "sorry_bonus": gather_data[1]}

        else:
            sorry_bonus =  await self.normal_flow_sorry_bonus(client_id)
            return {"client_id": client_id,
                    "client_first_name": client_first_name,
                    "is_email_provided": is_email_provided,
                    "is_email_confimed": is_email_confirmed,
                    "client_rate": client_rate,
                    "client_type": "normal",
                    "sorry_bonus": sorry_bonus}

    async def ship_freebet(self, client_id: str, email: str) -> dict[str, str]:
        return await self.api_client._send_freebet_request(client_id=client_id, email=email)
