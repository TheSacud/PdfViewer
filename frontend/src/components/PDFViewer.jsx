import React, { useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

function PDFViewer() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);

  // Função para buscar o PDF no backend
  const fetchPdf = async () => {
    try {
      const res = await fetch('/pdf');
      if (!res.ok) {
        console.error('Erro ao buscar o PDF');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Erro ao buscar PDF:', error);
    }
  };

  useEffect(() => {
    fetchPdf();
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Visualizador de PDF</h2>
      {pdfUrl ? (
        <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
          {Array.from(new Array(numPages), (el, index) => (
            <div key={`page_container_${index + 1}`} style={{ position: 'relative', marginBottom: '20px' }}>
              <Page pageNumber={index + 1} />
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                zIndex: 100,
              }}>
                Página {index + 1}
              </div>
            </div>
          ))}
        </Document>
      ) : (
        <p>Carregando PDF...</p>
      )}
    </div>
  );
}

export default PDFViewer;
