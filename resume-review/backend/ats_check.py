import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_openrouter import ChatOpenRouter
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

load_dotenv()

os.environ["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY", "")
os.environ["DEBUG"] = os.getenv("DEBUG", "")

model = ChatOpenRouter(
    model="nemotron-3-ultra-550b-a55b:free",
    temperature=0.0,
    top_p=1.0,
    seed=42
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are an ATS resume checker, provide score for the resume out of 100."),
    ("user", "{input}"),
])

output_parser = StrOutputParser()
chain = prompt_template | model | output_parser


def check_resume(resume_content: str) -> str:
    if not resume_content or not resume_content.strip():
        raise ValueError("resume_content is empty - nothing to score.")

    return chain.invoke({"input": resume_content})


if __name__ == "__main__":
    
    import resume_reader

    file_path = r"C:\Users\madha\OneDrive\Desktop\Madhav\MEC\MADHAV ANNUP-RESUME.pdf"
    resume_content = resume_reader.read_resume(file_path)
    print("Resume Score:", check_resume(resume_content))