let abortController = null;

async function download() {
  // Cancelar qualquer download anterior
  if (abortController) {
    abortController.abort();
    console.log("Download anterior cancelado.");
  }

  // Criar um novo controlador de cancelamento
  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    console.log("Iniciando o download...");
    document.getElementById("progresso").textContent = "Progresso: Iniciando...";

    const proxyUrl = `https://internet20.com.br/proxy?url=${encodeURIComponent(linkServer)}`;
    const response = await fetch(proxyUrl, { signal });

    if (!response.ok) {
      throw new Error(`Erro ao obter respostas: ${response.status} ${response.statusText}`);
    }

    const totalBytes = +response.headers.get("Content-Length") || 0;
    let loadedBytes = 0;

    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const decoder = new TextDecoder("utf-8");
    let content = "";

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      loadedBytes += value.length;
      content += decoder.decode(value, { stream: true });

      let progressText;
      if (totalBytes) {
        const percentage = ((loadedBytes / totalBytes) * 100).toFixed(2);
        progressText = `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)} (${percentage}%)`;
      } else {
        progressText = `${formatBytes(loadedBytes)} (tamanho desconhecido*)`;
      }

      console.log(`Progresso: ${progressText}`);
      document.getElementById("progresso").textContent = `Progresso: ${progressText}`;
    }

    console.log("Download completo.");
    document.getElementById("progresso").textContent = "Download completo!";
    abortController = null; // Resetar controlador após conclusão
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log("Download cancelado pelo usuário.");
      document.getElementById("progresso").textContent = "Download cancelado!";
    } else {
      console.error("Falha no download do arquivo:", error.message || error);
      document.getElementById("progresso").textContent = "Erro no download";
    }
    abortController = null; // Resetar controlador após erro
    throw error;
  }
}


// Restante das funções existentes com pequenos ajustes
function extractValue(line, key) {
  const startIndex = line.indexOf(key);
  if (startIndex !== -1) {
    const startQuote = line.indexOf('"', startIndex);
    if (startQuote !== -1) {
      const endQuote = line.indexOf('"', startQuote + 1);
      if (endQuote !== -1) {
        return line.substring(startQuote + 1, endQuote);
      }
    }
  }
  return "";
}

function extractChannelName(line) {
  const lastIndex = line.lastIndexOf(",");
  if (lastIndex !== -1) {
    return line.substring(lastIndex + 1).trim();
  }
  return "";
}

function organizarDados(list) {
  const groupedData = {};

  list.forEach((item) => {
    const { group } = item;

    if (!groupedData[group]) {
      groupedData[group] = {
        group: group,
        items: [],
      };
    }

    groupedData[group].items.push({
      name: item.name,
      id: item.id,
      logo: item.logo,
      channel: item.channel,
      link: item.link,
    });
  });


  return Object.values(groupedData);
}

function parseM3U8(m3u8Text) {
  const list = [];
  const lines = m3u8Text.split("\n");

  lines.forEach((line, index) => {
    if (line.includes("#EXTINF")) {
      try {
        const id = extractValue(line, "tvg-id");
        const name = extractValue(line, "tvg-name");
        const logo = extractValue(line, "tvg-logo");
        const group = extractValue(line, "group-title") || "- Sem grupo";
        const channel = extractChannelName(line);
        const link = lines[index + 1]?.trim();

        if (link) {
          list.push({ group, name, logo, id, channel, link });
        }
      } catch (err) {
        console.error("Erro ao processar linha:", line, err);
      }
    }
  });

  return organizarDados(list);
}

// Funções do IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("myDatabase", 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("lista")) {
        db.createObjectStore("lista", { keyPath: "id" });
      }
    };

    request.onsuccess = function (event) {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = function (event) {
      reject(event.target.errorCode);
    };
  });
}

function clearDatabase() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lista"], "readwrite");
    const objectStore = transaction.objectStore("lista");
    const clearRequest = objectStore.clear();

    clearRequest.onsuccess = function () {
      resolve();
    };

    clearRequest.onerror = function (event) {
      reject(event.target.errorCode);
    };
  });
}

function storeData(data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lista"], "readwrite");
    const objectStore = transaction.objectStore("lista");

    const request = objectStore.put({ id: "lista", data: data });

    request.onsuccess = function () {
      carregarDados();
      resolve();
    };

    request.onerror = function (event) {
      reject(event.target.errorCode);
    };
  });
}

// Funções de interface
function carregarDados() {
  const request = indexedDB.open("myDatabase", 1);
  
  request.onsuccess = function (event) {
    db = event.target.result;
    loadStoredData();
  };
  
  request.onerror = function (event) {
    console.error("Erro ao abrir o IndexedDB:", event.target.errorCode);
  };
}

function loadStoredData() {
  const transaction = db.transaction(["lista"], "readonly");
  const objectStore = transaction.objectStore("lista");
  const request = objectStore.get("lista");

  request.onsuccess = function (event) {
    if (request.result) {
      todoConteudo = request.result.data;
      OrganizarCategorias();
      organizeMedia(request.result.data);
      const body1 = document.querySelector(".section-pagination");
      const body2 = document.getElementById("containerSearch");
      body1.classList.remove("hidde");
      body2.classList.remove("hidde");
    }
  };

  request.onerror = function (event) {
    console.error("Erro ao recuperar dados:", event.target.errorCode);
  };
}

function OrganizarCategorias() {
  const grupos = todoConteudo.map((item) => item.group);
  select.innerHTML = '';
  
  grupos.forEach((element) => {
    const option = document.createElement("option");
    option.value = element;
    option.textContent = element;
    select.appendChild(option);
  });

  telaInicial();
}

async function organizeMedia(data) {
  let organized = {
    series: {},
    movies: [],
    channels: [],
  };

  const regexSerie =
    /^(.*?)(?:\s*[Ss](\d{1,2})\s*[Ee](\d{1,2})|[Ss](\d{1,2})[Ee](\d{1,2}))$/;

  data.forEach((item) => {
    if (!item.channel || !item.link || !item.logo || !item.name) return;

    const link = item.link.trim();
    if (!link.startsWith("http://") && !link.startsWith("https://")) return;

    if (link.includes("/series/")) {
      const seriesMatch = item.channel.match(regexSerie);
      if (seriesMatch) {
        const seriesName = seriesMatch[1].trim();
        const season = seriesMatch[2] || seriesMatch[4];
        const episode = seriesMatch[3] || seriesMatch[5];

        if (!organized.series[seriesName]) {
          organized.series[seriesName] = [];
        }

        organized.series[seriesName].push({
          ...item,
          season: season || "Desconhecida",
          episode: episode || "Desconhecido",
        });
      }
    } else if (link.includes("/movie/")) {
      organized.movies.push(item);
    } else {
      organized.channels.push(item);
    }
  });

  return organized;
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await openDatabase();
  carregarDados();
});
