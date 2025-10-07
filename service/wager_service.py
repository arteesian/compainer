import logging
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from database.crud import WagerRepository
from service.api_client_service import SecureAPIClient
from routes.wager_schemas import (
    UserActionBonusDB,
    CombinedUserResponse, UserActionBonusExtended
)
from service.exceptions import ExternalAPIError, UserNotFoundError

logger = logging.getLogger(__name__)


class UserWagerService:
    def __init__(
            self,
            db_session: AsyncSession,
            api_client: SecureAPIClient
    ):
        self.bonus_repo = WagerRepository(db_session)
        self.api_client = api_client


    @staticmethod
    def get_action_name(wager_data: dict, action_id: int):
        bonuses = wager_data["response"]["bonuses"]
        for bonus in bonuses:
            if bonus["id"] == str(action_id):
                action_name = bonus["object"].get("promoId", None)
                return action_name
        return None


    @staticmethod
    def get_rules_and_url(wager_data: dict):
        rules = wager_data["response"]["rules"][-1]["object"]["params"]["object"].get("fullDescription", {}).get("uni",None)
        url = wager_data["response"]["rules"][-1]["object"]["params"]["object"].get("rulesUrl", {}).get("uni", None)
        if "www.pari.ru" not in url:
            url = f"www.pari.ru/pages/{url}"
        return rules, url


    async def get_combined_user_data(self, user_id: str) -> CombinedUserResponse:
        try:

            bonuses = await self.bonus_repo.get_bonuses_by_user_id(user_id)

            api_response = await self.api_client.find_wager_url_rules_name(
                user_id=user_id
            )

            extended_bonuses = []

            for bonus in bonuses:
                db_schema = UserActionBonusDB.model_validate(bonus)
                action_name = UserWagerService.get_action_name(api_response, action_id=db_schema.action_id)
                rules, url = UserWagerService.get_rules_and_url(api_response)

                extended_dict = {
                    **db_schema.model_dump(),
                    "action_name": action_name,
                    "rules": rules,
                    "url": url
                }
                extended_bonus = UserActionBonusExtended(**extended_dict)
                extended_bonuses.append(extended_bonus)

            logger.info(f"Успешно получены данные для user_id={user_id}")


            return CombinedUserResponse(
                user_id=user_id,
                actions=extended_bonuses
            )

        except ExternalAPIError as e:
            logger.warning(
                f"Внешнее API недоступно для user_id={user_id}: {e.message}. "
                "Используем только данные из БД."
            )

            raise




