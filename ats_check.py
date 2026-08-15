import json
import os
from langchain_core.prompts import ChatPromptTemplate
#from langchain_openrouter import ChatOpenRouter
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

os.environ["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY", "")
os.environ["DEBUG"] = os.getenv("DEBUG", "")

model = AsyncOpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    seed=42,
    top_p=1.0,
    temperature=0.0,
    top_k=1
)

"""
    If you are implementing this code, you will need to install the langchain_openrouter package and uncomment the import statement above. 
    The ChatOpenRouter class is used to interact with the OpenRouter API for chat-based models.


model = ChatOpenRouter(
    model="nemotron-3.5-lightning:free",
    temperature=0.0,
    top_p=1.0,
    seed=42
)
"""


SYSTEM_PROMPT = """You are an expert ATS scanner.
Evaluate the resume and return a structured JSON response with keys:
- "score": Integer (0-100)
- "summary": Short string
- "strengths": List of strings
- "weaknesses": List of strings
- "suggestions": List of strings."""




prompt_template = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("user", "{input}"),
])

output_parser = StrOutputParser()
chain = prompt_template | model | output_parser


async def evaluate_resume(resume_text: str, job_description: str = "") -> dict:
    prompt = f"Resume:\n{resume_text}\n"
    if job_description:
        prompt += f"\nJob Description:\n{job_description}\n"

    response = await model.chat.completions.create(
        model="gemini-2.0-flash",  # Or "gemini-1.5-flash"
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        max_tokens=1500,
        timeout=30.0  # In seconds
    )

    return json.loads(response.choices[0].message.content)