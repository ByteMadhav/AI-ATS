import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_openrouter import ChatOpenRouter
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
import resume_reader

load_dotenv()
file_path = r"C:\Users\madha\OneDrive\Desktop\Madhav\MEC\MADHAV ANNUP-RESUME.pdf"

resume_content = resume_reader.read_resume(file_path)

os.environ["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY")
os.environ["DEBUG"] = os.getenv("DEBUG")

model=ChatOpenRouter(
    model="nemotron-3-ultra-550b-a55b:free",
    temperature=0.0,
    top_p=1.0,
    seed=42
    #model_kwargs={"response_format": {"type": "json_object"}}
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are an ATS resume checker, provide score for the resume out of 100."),
    ("user", "{input}")
])

output_parser = StrOutputParser()

chain= prompt_template | model | output_parser

response = chain.invoke([{"role": "user", "content": resume_content}])

print("Resume Score:", response)