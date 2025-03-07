// Apply theme when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Theme functionality removed as it was part of the configuracoes module
});

async function getHeaderForPDF(doc, title, startY = 20) {
    try {
        // Configuration functionality removed, using default title
        doc.setFontSize(18);
        doc.setTextColor(0, 51, 153);
        doc.text(title, 14, startY);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Sistema de Gerenciamento de Estoque Hospitalar", 14, startY + 8);
        return startY + 15;
    } catch (error) {
        console.error("Error creating PDF header:", error);
        // Default in case of error
        doc.setFontSize(18);
        doc.setTextColor(0, 51, 153);
        doc.text(title, 14, startY);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Sistema de Gerenciamento de Estoque Hospitalar", 14, startY + 8);
        return startY + 15;
    }
}