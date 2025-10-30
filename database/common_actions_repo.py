# repository.py
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy import delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload

from database.models import CommonAction, QuestionAnswer, ActionState


class CommonActionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session


    async def create_action(
        self,
        name: str,
        end_time: Optional[datetime] = None,
        start_time: Optional[datetime] = None,
        short_rules: Optional[str] = None,
        link: Optional[str] = None,
        is_vip: bool = False,
        answer: Optional[str] = None,
        players: Optional[str] = None,
        state: ActionState = ActionState.ACTIVE,
    ) -> CommonAction:
        action = CommonAction(
            name=name,
            short_rules=short_rules,
            link=link,
            start_time=start_time,
            end_time=end_time,
            is_vip=is_vip,
            answer=answer,
            players=players,
            state=state,
        )
        self.session.add(action)
        await self.session.flush()  # Получаем ID
        return action


    async def get_action_with_qa(self, action_id: int) -> Optional[CommonAction]:
        stmt = (
            select(CommonAction)
            .where(CommonAction.id == action_id)
            .options(selectinload(CommonAction.questions_answers))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


    async def list_actions_with_qa(
            self, offset: int = 0, limit: int = 10
    ) -> Tuple[List[CommonAction], int]:

        total_count = await self.session.scalar(
            select(func.count()).select_from(CommonAction)
        ) or 0

        stmt = (
            select(CommonAction)
            .offset(offset)
            .limit(limit)
            .options(selectinload(CommonAction.questions_answers))
            .order_by(CommonAction.id)
        )
        result = await self.session.execute(stmt)
        actions = list(result.scalars().all())
        return actions, total_count

    async def list_actions_with_qa_all(
            self,
            offset: int = 0,
            limit: int = 10,
            is_vip: Optional[bool] = None,
    ) -> Tuple[List[CommonAction], int]:

        query = select(CommonAction)
        count_query = select(func.count()).select_from(CommonAction)


        if is_vip is not None:
            query = query.where(CommonAction.is_vip == is_vip)
            count_query = count_query.where(CommonAction.is_vip == is_vip)


        total_count = await self.session.scalar(count_query) or 0


        stmt = (
            query
            .offset(offset)
            .limit(limit)
            .options(selectinload(CommonAction.questions_answers))
            .order_by(CommonAction.id)
        )

        result = await self.session.execute(stmt)
        actions = list(result.scalars().all())
        return actions, total_count

    async def update_action(
        self,
        action_id: int,
        **kwargs,
    ) -> CommonAction:
        result = await self.session.execute(
            select(CommonAction).where(CommonAction.id == action_id)
        )
        action = result.scalar_one_or_none()
        if not action:
            raise ValueError(f"Action {action_id} not found")

        updatable_fields = {
            "name", "short_rules", "link", "start_time", "end_time",
            "is_vip", "answer", "players", "state"
        }
        for key, value in kwargs.items():
            if key in updatable_fields and value is not None:
                setattr(action, key, value)

        self.session.add(action)
        return action


    async def delete_action(self, action_id: int) -> bool:
        result = await self.session.execute(
            delete(CommonAction).where(CommonAction.id == action_id)
        )
        return result.rowcount > 0


    async def create_question_answer(
        self,
        action_id: int,
        question: str,
        answer: Optional[str] = None,
        who_sent: Optional[str] = None,
        is_approved: bool = False,
    ) -> QuestionAnswer:

        result = await self.session.execute(
            select(CommonAction).where(CommonAction.id == action_id)
        )

        if not result.scalar_one_or_none():
            raise ValueError(f"Action {action_id} does not exist")

        qa = QuestionAnswer(
            action_id=action_id,
            question=question,
            answer=answer,
            who_sent=who_sent,
            is_approved=is_approved,
        )
        self.session.add(qa)
        await self.session.flush()
        return qa


    async def update_question_answer(
        self,
        qa_id: int,
        **kwargs,
    ) -> QuestionAnswer:
        result = await self.session.execute(select(QuestionAnswer).where(QuestionAnswer.id == qa_id))
        qa = result.scalar_one_or_none()
        if not qa:
            raise ValueError(f"QA {qa_id} not found")

        updatable_fields = {"question", "answer", "who_sent", "is_approved"}
        for key, value in kwargs.items():
            if key in updatable_fields and value is not None:
                setattr(qa, key, value)

        self.session.add(qa)
        return qa


    async def approve_question_answer(self, qa_id: int) -> QuestionAnswer:
        return await self.update_question_answer(qa_id, is_approved=True)


    async def delete_question_answer(self, qa_id: int) -> bool:
        result = await self.session.execute(
            delete(QuestionAnswer).where(QuestionAnswer.id == qa_id)
        )
        return result.rowcount > 0


    async def get_question_answer(self, qa_id: int) -> Optional[QuestionAnswer]:
        result = await self.session.execute(
            select(QuestionAnswer).where(QuestionAnswer.id == qa_id)
        )
        return result.scalar_one_or_none()
    
    async def get_all_unapproved(self) -> Optional[list[QuestionAnswer]]:
        result = await self.session.execute(
            select(QuestionAnswer).where(QuestionAnswer.is_approved.is_(False))
        )
        unapproved_qas = result.scalars().all()
        return unapproved_qas
    
    async def search_actions_by_name(
            self,
            query: str,
            offset: int = 0,
            limit: int = 10
    ) -> Tuple[List[CommonAction], int]:

        filter_condition = CommonAction.name.icontains(query)

        total_count = await self.session.scalar(
            select(func.count()).select_from(CommonAction).where(filter_condition)
        ) or 0

        stmt = (
            select(CommonAction)
            .where(filter_condition)
            .offset(offset)
            .limit(limit)
            .options(selectinload(CommonAction.questions_answers))
            .order_by(CommonAction.name)
        )
        result = await self.session.execute(stmt)
        actions = list(result.scalars().all())
        return actions, total_count