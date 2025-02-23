import React, { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
      const res = await fetch(`${API_URL}/pdf`);
      if (!res.ok) {
        pdfContainer.innerHTML = 'Nenhum PDF disponível.';
        return;
      }

      const pdfData = await res.arrayBuffer();
      const header = new TextDecoder().decode(pdfData.slice(0, 5));
      // Opcional: console.log('Cabeçalho do PDF:', header);

      const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
      loadingTask.promise.then(
        (pdf) => {
          pdfContainer.innerHTML = ''; // Limpa o container
          console.log('Número de páginas no PDF:', pdf.numPages);

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            pdf.getPage(pageNum).then((page) => {
              const scale = 1.0;
              const viewport = page.getViewport({ scale });
              // Cria um container para a página
              const pageContainer = document.createElement('div');
              pageContainer.style.position = 'relative';
              pageContainer.style.marginBottom = '20px';

              // Cria o canvas para renderizar a página
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

              // Cria o elemento para exibir o número da página
              const pageNumberElem = document.createElement('div');
              pageNumberElem.innerText = 'Página ' + pageNum;
              pageNumberElem.classList.add('page-number');

              // Adiciona o canvas e o número ao container da página
              pageContainer.appendChild(canvas);
              pageContainer.appendChild(pageNumberElem);
              // Adiciona o container da página ao container geral do PDF
              pdfContainer.appendChild(pageContainer);

              console.log('Adicionada página ' + pageNum);
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
    const fileInput = fileInputRef.current;
    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Selecione um arquivo PDF.');
      return;
    }
    const position = positionInputRef.current.value;
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('position', position);
    const res = await fetch(`${API_URL}/pdf/insert`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    alert(data.message);
    // Limpa os inputs
    fileInput.value = '';
    positionInputRef.current.value = '';
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handler para atualizar a visualização do PDF
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Novo handler para download do PDF
  const handleDownload = async () => {
    try {
      const response = await fetch(`${API_URL}/download`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Erro ao baixar PDF');

      // Usar window.location em vez de blob
      const downloadUrl = `${API_URL}/download`;
      window.location.href = downloadUrl;

    } catch (error) {
      console.error('Erro no download:', error);
    }
  };

   // Handler para adicionar uma nova página com título
   const handleAddPageTitle = async () => {
    const title = titleInputRef.current.value;
    const position = titlePositionRef.current.value;
    const fontChoice = fontInputRef.current.value;
    if (!title) {
      alert("Por favor, insira o título da nova página.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/pdf/addPageTitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, position, font: fontChoice}),
      });
      const data = await res.json();
      alert(data.message);
      // Limpa os inputs para título
      titleInputRef.current.value = '';
      titlePositionRef.current.value = '';
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Erro ao adicionar página com título:", error);
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
