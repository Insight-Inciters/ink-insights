import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

def export_csv(result):
    df = pd.DataFrame(result["keywords"]["list"])
    df["pos"] = result["sentiment"]["pos"]
    df["neu"] = result["sentiment"]["neu"]
    df["neg"] = result["sentiment"]["neg"]
    path = "uploads/analysis_results.csv"
    df.to_csv(path, index=False)
    return path

def export_pdf(result):
    path = "uploads/analysis_results.pdf"
    c = canvas.Canvas(path, pagesize=A4)
    c.setFont("Helvetica", 12)
    c.drawString(100, 800, "Ink Insights — Text Analysis Report")
    c.drawString(100, 780, f"Top Keyword: {result['keywords']['top']}")
    c.drawString(100, 760, f"Sentiment: Pos {result['sentiment']['pos']}%  Neu {result['sentiment']['neu']}%  Neg {result['sentiment']['neg']}%")
    c.drawString(100, 740, f"Dominant Emotion: {result['emotions']['dominant']}")
    c.drawString(100, 720, f"Total Unique Words: {result['keywords']['unique']}")
    c.drawString(100, 700, "Top Keywords:")
    y = 680
    for item in result["keywords"]["list"][:10]:
        c.drawString(120, y, f"- {item['token']} ({item['count']})")
        y -= 15
    c.save()
    return path
