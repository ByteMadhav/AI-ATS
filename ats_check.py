import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_openrouter import OpenRouter
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

load_dotenv()

os.environ["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY")
os.environ["DEBUG"] = os.getenv("DEBUG")

model=OpenRouter(
    model="nemotron-3-ultra-550b-a55b:free"
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are an ATS resume checker, provide score for the resume out of 100."),
    ("user", "{input}")
])

output_parser = StrOutputParser()

chain= model | prompt_template | output_parser

response = chain.invoke({"input": "Please check the resume and provide a score out of 100."})