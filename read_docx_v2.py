import zipfile
import xml.etree.ElementTree as ET
import sys

def get_docx_text(path):
    try:
        document = zipfile.ZipFile(path)
        xml_content = document.read('word/document.xml')
        document.close()
        tree = ET.XML(xml_content)
        WORD_NAMESPACE = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        TEXT = WORD_NAMESPACE + 't'
        texts = [node.text for node in tree.iter(TEXT) if node.text]
        return ' '.join(texts)
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(get_docx_text(sys.argv[1]))
