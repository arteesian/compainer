# manual_secure_api_client.py
import asyncio

import pytest
from service.api_client_service import SecureAPIClient
import pprint as pp


async def manual_calculate_user_bonus():
    client = SecureAPIClient(
        base_url="https://backoffice.pbsvc.bz/",  # или мок-сервер
    )

    result = await client.find_wager_url_rules_name("18529652")
    pp.pprint(result)
    return result


