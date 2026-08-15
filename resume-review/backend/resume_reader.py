import io
import pdfplumber


def read_resume(file_input):
   
    if isinstance(file_input, (bytes, bytearray)):
        pdf_stream = io.BytesIO(file_input)

    elif isinstance(file_input, str):
        
        with open(file_input, "rb") as f:
            pdf_stream = io.BytesIO(f.read())

    elif hasattr(file_input, "read"):
        file_input.seek(0)
        pdf_stream = io.BytesIO(file_input.read())

    else:
        raise TypeError(
            "read_resume expects bytes, a file path, or a file-like object, "
            f"got {type(file_input)!r}"
        )

    full_text = ""
    pdf_stream.seek(0)
    with pdfplumber.open(pdf_stream) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n\n"

    return full_text.strip()