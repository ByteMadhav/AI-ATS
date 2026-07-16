from langchain_community.document_loaders import PDFPlumberLoader

def extract_text_from_pdf(file_path):

    file_path = r"C:\Users\madha\OneDrive\Desktop\Madhav\MEC\MADHAV ANNUP-RESUME.pdf"  
    loader=PDFPlumberLoader(file_path)
    documents=loader.load()

    full_text = ""

    if documents:
        for doc in documents:
            full_text += doc.page_content + "\n\n"
    
    return full_text.strip()