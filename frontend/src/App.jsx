import React, { useEffect, useRef, useState } from 'react';

function App() {
  const pdfContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const positionInputRef = useRef(null);

  const titleInputRef = useRef(null);         // Texto do título
  const titlePositionRef = useRef(null);        // Posição para inserir a página com título
  const fontInputRef = useRef(null);           // Fonte para o título

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Função para buscar e renderizar o PDF usando PDF.js
  const refreshPdf = async () => {
    const pdfContainer = pdfContainerRef.current;
    pdfContainer.innerHTML = 'Carregando PDF...';

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/pdf`);
      if (!res.ok) {
        pdfContainer.innerHTML = 'Nenhum PDF disponível.';
        return;
      }

      const pdfData = await res.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
      loadingTask.promise.then(
        (pdf) => {
          pdfContainer.innerHTML = '';
          console.log('Número de páginas no PDF:', pdf.numPages);

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            pdf.getPage(pageNum).then((page) => {
              const scale = 1.0;
              const viewport = page.getViewport({ scale });
              
              const pageContainer = document.createElement('div');
              pageContainer.style.position = 'relative';
              pageContainer.style.marginBottom = '20px';

              const canvas = document.createElement('canvas');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              canvas.style.display = 'block';
              canvas.style.position = 'relative';
              canvas.style.zIndex = '1';
              
              const context = canvas.getContext('2d');
              const renderContext = {
                canvasContext: context,
                viewport: viewport,
              };
              page.render(renderContext);

              const pageNumberElem = document.createElement('div');
              pageNumberElem.innerText = 'Página ' + pageNum;
              pageNumberElem.classList.add('page-number');

              pageContainer.appendChild(canvas);
              pageContainer.appendChild(pageNumberElem);
              pdfContainer.appendChild(pageContainer);
            });
          }
        },
        (err) => {
          console.error('Erro ao carregar PDF:', err);
          pdfContainer.innerHTML = 'Erro ao carregar PDF.';
        }
      );
    } catch (err) {
      console.error('Erro:', err);
      pdfContainer.innerHTML = 'Erro ao carregar PDF.';
    }
  };

  // Atualiza o PDF sempre que refreshTrigger mudar
  useEffect(() => {
    refreshPdf();
  }, [refreshTrigger]);

  // Handler para inserir um PDF no documento atual
  const handleUpload = async () => {
    try {
      const fileInput = fileInputRef.current;
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Selecione um arquivo PDF.');
        return;
      }
      const position = positionInputRef.current.value;
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('position', position);
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/pdf/insert`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      alert(data.message);
      
      fileInput.value = '';
      positionInputRef.current.value = '';
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload do PDF.');
    }
  };

  // Handler para atualizar a visualização do PDF
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Novo handler para download do PDF
  const handleDownload = async () => {
    try {
      console.log('🔄 Iniciando download...');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/download`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log('📋 Headers da resposta:', {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        contentDisposition: response.headers.get('content-disposition')
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Método 1: Usando Blob
      const blob = await response.blob();
      console.log('📊 Tamanho do blob:', blob.size);
      console.log('📄 Tipo do blob:', blob.type);

      if (blob.size < 1000000) { // Se menor que 1MB
        console.warn('⚠️ Arquivo parece estar truncado!');
      }

      // Método alternativo: usar window.open
      const downloadUrl = window.URL.createObjectURL(blob);
      console.log('🔗 URL gerada:', downloadUrl);

      // Tentar ambos os métodos de download
      try {
        // Método 1: Link tradicional
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `documento_${Date.now()}.pdf`;
        document.body.appendChild(link);
        console.log('📥 Tentando download via link...');
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('❌ Erro no método 1:', err);
        
        // Método 2: window.open
        console.log('📥 Tentando download via window.open...');
        window.open(downloadUrl, '_blank');
      }

      // Limpar URL após um pequeno delay
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        console.log('🧹 URL do blob liberada');
      }, 1000);

    } catch (error) {
      console.error('❌ Erro detalhado no download:', error);
      console.error('Stack:', error.stack);
      alert('Erro ao fazer download do PDF. Verifique o console para mais detalhes.');
    }
  };

   // Handler para adicionar uma nova página com título
   const handleAddPageTitle = async () => {
    try {
      const title = titleInputRef.current.value;
      const position = titlePositionRef.current.value;
      const fontChoice = fontInputRef.current.value;
      
      if (!title) {
        alert("Por favor, insira o título da nova página.");
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/pdf/addPageTitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, position, font: fontChoice }),
      });

      const data = await res.json();
      alert(data.message);
      
      titleInputRef.current.value = '';
      titlePositionRef.current.value = '';
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Erro ao adicionar página com título:", error);
      alert("Erro ao adicionar página com título.");
    }
  };
  

  return (
    <div>
      <header>
        <h1>pdfViewer</h1>
        <p>Mesclar, visualizar e editar PDFs de forma simples e elegante</p>
      </header>
      <section className="controls">
        {/* Controle para inserir um PDF */}
        <input type="file" ref={fileInputRef} accept="application/pdf" />
        <input
          type="number"
          ref={positionInputRef}
          placeholder="Posição (opcional) para Inserir PDF"
        />
        <button onClick={handleUpload}>Inserir PDF</button>

        {/* Botões para atualizar visualização e download */}
        <button onClick={handleRefresh}>Atualizar Visualização</button>
        <button onClick={handleDownload}>Download PDF</button>

        {/* Controles para adicionar uma página com título */}
        <input type="text" ref={titleInputRef} placeholder="Título da Página" />
        <input type="number" ref={titlePositionRef} placeholder="Posição (opcional) para Título" />
        <input type="text" ref={fontInputRef} placeholder="Fonte (ex: helvetica, timesroman, courier)" />
        <button onClick={handleAddPageTitle}>Adicionar Página com Título</button>

      </section>
      <section id="pdfContainer" ref={pdfContainerRef}>
        Carregando PDF...
      </section>
    </div>
  );
}

export default App;
