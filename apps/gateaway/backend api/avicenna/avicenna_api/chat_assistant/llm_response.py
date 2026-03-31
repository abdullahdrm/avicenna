from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_openrouter import ChatOpenRouter
# from langchain_community.chat_models import ChatOllama

from avicenna_api.models import Submission, DoctorProfile
from .rag.rag_services import get_rag_result


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


SYSTEM_PROMPT = """
You are a helpful assistant for skin health platform called Avicenna.
You are answering patient questions.
Answer short and precise. 

Rules for tool usage:
- Use get_manual_info for app/manual questions.
- Use all_submissions first whenever the user asks about:
  - their submissions
  - the doctor of a submission
  - a report of a submission
  - the latest or previous submission
- all_submissions is only for finding ids and basic submission metadata.
- If the user asks for doctor details, you must call doctor_info_from_doctor_id after all_submissions to get the final answer.
- If the user asks for report details, you must first identify the correct submission id, then call the report tool.
- Do not stop after all_submissions if the question asks for detailed doctor/report information.
- If no tool is related, answer: "I can't answer that question."
- Only answer based on tool results.
""".strip()


def build_graph_for_user(user):
    @tool
    def get_manuel_info(message: str) -> str:
        """Get information about the app usage from the manual."""
        print("get_manual_info tool called with query:", message)
        return get_rag_result(message)

    @tool
    def all_submissions() -> str:
        """
        Get the current user's submissions.
        Use this tool first to identify submission ids and doctor ids.
        Do not use this tool as the final source for doctor details or full report details.
        """
        print("all_submissions tool called")

        submissions = Submission.objects.filter(
            patient=user
        ).select_related("doctor").order_by("-created_at")

        if not submissions.exists():
            return "You have no submissions."

        result = []

        for sub in submissions:
            info = []
            info.append(f"Submission ID: {sub.id}")
            info.append(f"Doctor ID: {sub.doctor.id}")
            info.append(f"Status: {sub.status}")
            info.append(
                f"Created at: {sub.created_at.strftime('%Y-%m-%d %H:%M')}")
            result.append("\n".join(info))

        return "\n\n---\n\n".join(result)

    @tool
    def doctor_info_from_doctor_id(doctor_id: int) -> str:
        """
        Get doctor information by doctor user id.
        Before calling this tool, you should call all_submissions tool to get doctor ids.
        """
        print("doctor_info_from_doctor_id tool called with doctor_id:", doctor_id)

        try:
            doctor_profile = DoctorProfile.objects.select_related("doctor").get(
                doctor_id=doctor_id
            )
        except DoctorProfile.DoesNotExist:
            return f"No doctor found with id {doctor_id}."

        doctor = doctor_profile.doctor

        info = [
            f"Doctor ID: {doctor.id}",
            f"Email: {doctor.email}",
            f"Username: {doctor.username}",
            f"Role: {doctor.role}",
            f"Experience Years: {doctor_profile.experience_years}",
            f"City: {doctor_profile.city}",
            f"Hospital: {doctor_profile.hospital}",
            f"Allowed Days: {', '.join(doctor_profile.allowed_days) if doctor_profile.allowed_days else 'None'}",
            f"Max Submissions Per Day: {doctor_profile.max_submissions_per_day}",
        ]

        return "\n".join(info)

    tools = [get_manuel_info, all_submissions, doctor_info_from_doctor_id]

    llm = ChatOpenRouter(
        model="meta-llama/llama-3-8b-instruct",
        temperature=0,
        api_key=None,
    )

    llm_with_tools = llm.bind_tools(tools)

    def assistant_node(state: AgentState) -> AgentState:
        response = llm_with_tools.invoke(
            [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        )
        return {"messages": [response]}

    tool_node = ToolNode(tools)

    graph_builder = StateGraph(AgentState)
    graph_builder.add_node("assistant", assistant_node)
    graph_builder.add_node("tools", tool_node)

    graph_builder.add_edge(START, "assistant")
    graph_builder.add_conditional_edges(
        "assistant",
        tools_condition,
        {
            "tools": "tools",
            "__end__": END,
        },
    )
    graph_builder.add_edge("tools", "assistant")

    return graph_builder.compile()
