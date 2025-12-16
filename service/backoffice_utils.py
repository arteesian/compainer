from __future__ import annotations

from typing import Any, Optional, Tuple


# ========================== client_information ==========================
def has_ident_needed(client_information: dict[str, Any]) -> bool:
    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Client.Extension":
            obj = bo_class["object"]

            if obj.get("extIdentNeeded"):
                return True

    return False

def has_bad_statuses(client_information: dict[str, Any]) -> bool:
    """
    Проверка негативных статусов клиента по client_information.
    """
    for_manual_restrictions = {
        "9998", "100000", "9986", "9984", "9990", "29", "157", "9992", "9981", "124", "120",
        "159", "9991", "105", "9993", "9988", "191", "192", "193", "194"
    }

    for_antifraud_restrictions = {
        "77", "139", "84", "69", "76", "112", "96", "83", "9994", "73", "115", "113", "102",
        "9997", "9987", "104", "109"
    }

    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Client.Extension":
            obj = bo_class["object"]

            # клиент на выход
            if obj.get("getOutClient"):
                return True

            # manualRestrictions
            manual = obj.get("manualRestrictions") or []
            if manual:
                if any(code in for_manual_restrictions for code in manual):
                    return True

            # antifraudRestrictions
            antifraud = obj.get("antifraudRestrictions") or []
            antifraud_sports = obj.get("antifraudRestrictionsSports") or []

            if antifraud:
                # проверка соответствия for_antifraud_restrictions -- antifraud_sports == "0"
                for idx, code in enumerate(antifraud):
                    if code in for_antifraud_restrictions:
                        if idx < len(antifraud_sports) and antifraud_sports[idx] == "0":
                            return True

            # если добрались сюда – значимых ограничений не нашли
            return False

    # если вообще не нашли Fon.Client.Extension
    return False

def is_vip(client_information: dict[str, Any]) -> bool:
    """
    Проверка VIP-статуса клиента по gradeRatings.
    """
    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Antifraud.ClientGrades":
            ratings = bo_class["object"].get("gradeRatings") or []
            if not ratings:
                return False

            for client_rating in ratings:
                obj = client_rating["object"]
                grade_type = obj.get("gradeType")
                manual_subtype = obj.get("manualSubType")

                if grade_type == "8" and manual_subtype in {"803", "814", "809", "807", "808"}:
                    return True
                if grade_type == "25" and manual_subtype == "2502":
                    return True

            return False
    return False

def has_score_and_bh_status(client_information: dict[str, Any]) -> bool:
    """
    Проверка на наличие статусов СКОР и БХ у клиента по gradeRatings.
    """
    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Antifraud.ClientGrades":
            ratings = bo_class["object"].get("gradeRatings") or []
            if not ratings:
                return False

            has_score = False
            has_bh = False

            for client_rating in ratings:
                obj = client_rating["object"]
                grade_type = obj.get("gradeType")
                manual_subtype = obj.get("manualSubType")

                if grade_type == "22" and manual_subtype == "2201":
                    has_score = True

                if grade_type == "4" and manual_subtype == "401":
                    has_bh = True

            if has_score and has_bh:
                return True

            return False
    return False

def get_client_name(client_information: dict[str, Any]) -> Optional[str]:
    """
    Достаём имя клиента из fullFIO (Fon.Ora.Client).
    Берём второе слово (имя), если оно есть.
    """
    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Ora.Client":
            obj = bo_class.get("object") or {}
            full_fio = obj.get("fullFIO")
            if not full_fio:
                return None
            parts = full_fio.split()
            return parts[1] if len(parts) >= 2 else None
    return None


def is_email_provided(client_information: dict[str, Any]) -> bool:
    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Client.Extension":
            return bo_class["object"].get("email") is not None
    return False


def is_email_confirmed(client_information: dict[str, Any]) -> bool:
    for bo_class in client_information["response"]["list"]:
        if bo_class["class"] == "Fon.Client.Extension":
            return bool(bo_class["object"].get("emailConfirmed"))
    return False

def is_verified(client_information: dict[str, Any]) -> bool:
    """
    Проверяем статус идентификации клиента
    Верифицирован:
      cupisBindState in {2,3} AND cupisIdentLevel in {2,3}
    Не верифицирован:
      cupisBindState in {0,1} OR cupisIdentLevel in {0,1}
    """
    bind_state = None
    ident_level = None

    for bo_class in client_information.get("response", {}).get("list", []):
        obj = bo_class.get("object") or {}
        if "cupisBindState" in obj:
            bind_state = obj.get("cupisBindState")
        if "cupisIdentLevel" in obj:
            ident_level = obj.get("cupisIdentLevel")

    return (str(bind_state) in {"2", "3"}) and (str(ident_level) in {"2", "3"})

def has_self_exclusion(client_information: dict[str, Any]) -> bool:
    """
    Проверка на самоисключения клиента: поле restrictions содержит код "9010"
    """

    for bo_class in client_information.get("response", {}).get("list", []):
        obj = bo_class.get("object") or {}
        restrictions = obj.get("restrictions") or []
        if isinstance(restrictions, list) and "9010" in {str(x) for x in restrictions}:
            return True
    return False
