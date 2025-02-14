function cleanTitle(title) {
    if (title) {
      // Remove texto dentro de parênteses, colchetes ou chaves, e caracteres `:` e `-`
      let cleanedTitle = title
        .replace(/\(.*?\)|\[.*?\]|\{.*?\}|[:\-]/g, "")
        .trim();

      // Remove formatos como "S01 E01", "S01E01", ou "S04E109"
      cleanedTitle = cleanedTitle
        .replace(/\bS\d{1,2}\s?E\d{1,3}\b/g, "") // Captura tanto "S01 E01" quanto "S01E01" e "S04E109"
        .trim();

      return cleanedTitle;
    } else {
      console.error("O título do filme está indefinido");
      return "";
    }
  }

  function fetchMovieInfo(movieTitle, tv, delayTime) {
    return new Promise((resolve, reject) => {
      if (!movieTitle) {
        reject("Título do filme indefinido");
        return;
      }
  
      movieTitle = cleanTitle(movieTitle);
  
      const genreMapping = {
        Action: "Ação",
        Adventure: "Aventura",
        Animation: "Animação",
        Comedy: "Comédia",
        Crime: "Crime",
        Documentary: "Documentário",
        Drama: "Drama",
        Family: "Família",
        Fantasy: "Fantasia",
        History: "História",
        Horror: "Terror",
        Music: "Música",
        Mystery: "Mistério",
        Romance: "Romance",
        "Science Fiction": "Ficção científica",
        Thriller: "Suspense",
        War: "Guerra",
        Western: "Faroeste",
      };
  
      const tryFetch = (title) => {
        return new Promise((resolveFetch, rejectFetch) => {
          const searchUrl = `https://api.themoviedb.org/3/search/${
            tv ? "tv" : "movie"
          }?query=${encodeURIComponent(
            title
          )}&api_key=${apiKey}&language=pt-BR`;
  
          console.log("Buscando:", title);
          fetch(searchUrl)
            .then((response) => response.json())
            .then((data) => {
              if (!data.results?.length) {
                resolveFetch(null); // Retorna null se não encontrar
              } else {
                resolveFetch(data.results[0]); // Retorna o primeiro resultado
              }
            })
            .catch((error) => rejectFetch(error));
        });
      };
  
      setTimeout(async () => {
        try {
          let searchResult;
  
          // Tentativa 1: Título original
          searchResult = await tryFetch(movieTitle);
  
          // Tentativa 2: Remover anos válidos (1900-2099)
          if (!searchResult) {
            console.log("Tentativa sem ano...");
            const regexAno = /\b(19|20)\d{2}\b/; // Regex para detectar anos (1900-2099)
            const movieTitleWithoutYear = movieTitle.replace(regexAno, "").trim();
            searchResult = await tryFetch(movieTitleWithoutYear);
          }
  
          // Tentativa 3: Remover números não relacionados ao ano
          if (!searchResult) {
            console.log("Tentativa sem números não relacionados...");
            const movieTitleWithoutNumbers = movieTitle.replace(/\b\d+\b/g, "").trim();
            searchResult = await tryFetch(movieTitleWithoutNumbers);
          }
  
          // Tentativa 4: Buscar apenas palavras iniciais
          if (!searchResult) {
            console.log("Tentativa com palavras iniciais...");
            const firstWords = movieTitle.split(" ").slice(0, 3).join(" ");
            searchResult = await tryFetch(firstWords);
          }
  
     
          if (!searchResult) {
            console.log("Filme não encontrado:", movieTitle);
            resolve(null);
            return;
          }
  
          // Obtém os detalhes do filme
          const movieId = searchResult.id;
          const detailsUrl = `https://api.themoviedb.org/3/${
            tv ? "tv" : "movie"
          }/${movieId}?api_key=${apiKey}&language=pt-BR&append_to_response=videos,credits`;
  
          const detailsResponse = await fetch(detailsUrl);
          const details = await detailsResponse.json();
  
          const trailer = details.videos?.results.find(
            (video) => video.type === "Trailer" && video.site === "YouTube"
          );
          const elenco =
            details.credits?.cast.map((ator) => ({
              nome: ator.name,
              personagem: ator.character,
            })) || [];
  
       
          resolve({
            capa: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
            fundo: `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${details.backdrop_path}`,
            sinopse: details.overview,
            dataLancamento: details.release_date || details.first_air_date,
            generos: details.genres.map(
              (genre) => genreMapping[genre.name] || genre.name
            ),
            elenco,
            votos: details.vote_average,
            votosIMDB: details.vote_average, // Adicionando a pontuação IMDb
            total_votos: details.vote_count,
            lancamento: details.release_date || details.first_air_date,
            trailer: trailer
              ? `https://www.youtube.com/embed/${trailer.key}`
              : null,
            nacionalidade: details.origin_country,
          });
        } catch (error) {
          reject(error);
        }
      }, delayTime);
    });
  }
  
