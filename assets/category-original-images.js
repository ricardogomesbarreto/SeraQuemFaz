'use strict';
/* Registro de recuperação das 51 URLs públicas image_url de public.categories,
   consultado em 2026-11-04. São URLs EXTERNAS, NÃO arquivos no Storage.
   A consulta à API MySQL sempre tem prioridade sobre este instantâneo. */
(function(scope) {
  const URLS = Object.freeze({
  "Advogado": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTn7J3PBBaeXv0AVe13oVkVYxRbm_HzQYdSP8CWdXvxHg&s=10",
  "Ar-Condicionado": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3L8yp1ChN54FhKBfdoesRDM4QscVEwG4cIQwQH3DG_0SDwF-tP-RSWI8&s=10",
  "Arquitetura": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYpEwYNaZkR6-bDeB0eiBUKUJFBk9XK_opGdmRXF29yA&s=10",
  "Automação Residencial": "https://dcdn-us.mitiendanube.com/stores/001/219/023/products/projeto-automacao-511-ebacc3fc2a03ed0b8315917312347688-1024-1024.webp",
  "Barbeiro": "https://www.iped.com.br/img/cursos/60504/60504-1.jpg",
  "Buffet": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1JsjsNLwRwyW3liZbY9Cq8ogSfY_VOnsi4jtLx4Qlsg&s=10",
  "Cabeleireiro": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPbyWF3XXZOvXEB3HxmbiLKFE1XBvJEUT6_b6gtPvpKw&s=10",
  "Construção": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSMvPeVVVJXz-ASnpAN0OpyU09M3Z-m05sMbrBtsh2rBF218VX4egaWah0q&s=10",
  "Contador": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHgNxWchUVzkznoBCecnM9J3fpPDIhyKOvxTcDg-lHgA&s=10",
  "Costureiro": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQsYbTcFuXZkHldl66_GmSnyze70fO2zFwyXq4H1OHOzisL-upebybeeHhP&s=10",
  "Decoração": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqd4VEPOteZmy1jnGaVlxYrtja0tAdqtTWzemcNzRikdlrZxdwwb7m5YTW&s=10",
  "Designer": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSaF2_22ANWd2x-7BqYX3xBii3OxYSEmNvmHHmlkajaGTuHTmDv4TWYoGA&s=10",
  "DJ": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTKBu-k5e5MHCmCjaxQjPdEW7IYR78-EafP9zsQDw22tw&s=10",
  "Editor de Vídeo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmCoY6L-sraZ-hlDx_l522zEz8qk4gA_kElh1LDzlodQ&s=10",
  "Eletricista": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJdX8Iauof2UYRO0UaIgPYAw6y8RFNtUB8gN0dbESmmUNu2A0c8S5GIvY8&s=10",
  "Eletrônica": "https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/1/2020/11/high-angle-female-technician-with-electronics-soldering-iron-scaled.jpg",
  "Encanador": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQx1Qm_PixhrYGYAnxUXB5DQHyqWFaMYz-At0IR-ooYuA&s=10",
  "Engenharia": "https://tse3.mm.bing.net/th/id/OIP.kaigdTHd2at287hUR3bEFgHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
  "Entregador": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTWbdB8C_0x5pNozNTI82vt_wj-h22JGqvXPHzwCSL-RA&s=10",
  "Estofador": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-xUNWZtHdTFDjOZif_VBcIH2W9-6gij59v2mszKR9iu_nJ0deVlMkkDE&s=10",
  "Eventos": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBoOfGQypfwq4OS-FCFerm0bxHubXWx_rcHBzd_ponSJ5yrqtylmCcyPP8&s=10",
  "Fotocópias e Impressões": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3pgc8e0rC0XIFGvUUBP1ZxyppBEBvTSmqtyky6dd5dAElYzcnCt9prRC9&s=10",
  "Fotógrafo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTCYnd1yjwANxvK5_ChmFQon05smlY3uMQ95lFVMFDzLxm5BemSN2rLEUxf&s=10",
  "Fotógrafo de Eventos": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTmpBwAjXOfcOFkLYoLgi3ZIob2FLOxNf1TH4g9-e1waw&s=10",
  "Gráfica": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMu9RFfZRhdMMvS9_Umy3xsrkV0UmKz1ucWu6njx0mug&s=10",
  "Instalador de Câmeras": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUcEktOY3ykup5UhVnHsw7ykPpJwO7WsWqZgI91BQ2I-liCgJQ0zVoCcE&s=10",
  "Instalador de Internet": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT82zNuud5S6z_8L8cYOgpFOa44ateoHwOD4asqUHLCRA&s=10",
  "Instalador de TV": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8HKgXn9pYd-2knyiEyodth7hDODePwzo7_XBUbKSZ8HYS87GOYxgI4yMa&s=10",
  "Jardineiro": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSoRP9BzAjLHBRsi0fSv6WRxX5jXgxniERZJx0NBaTSKQ&s=10",
  "Limpeza": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRoc1oqNL2zkFHyyGNP6H6JA5R-9KyuBmNBrRLtKddDlA&s=10",
  "Manicure e Pedicure": "https://cursos.ce.senac.br/wp-content/uploads/2022/05/shutterstock_1156016407.jpg",
  "Manutenção": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsR_e4vE-u-hZ2eLGIFdupy57Q13LaZOkQkxDuA9etJRUYo9T00sEkvmLC&s=10",
  "Marceneiro": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwYuRQ_M5NfxqBrByf3zHDOZBh48xnAvngFSwnNjeQLZrlGbY1ZPnPug&s=10",
  "Marketing": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-QZ0ZY8CYa4Hmq-0hQIEZloWU9eDe8TWmJd6i4EiXICLCDlpWw3sjkg4&s=10",
  "Massagista": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL_fcyrm4QGcS_xAAKlmrenZH0kTDDUs22QdWEmRXLBA&s=10",
  "Mecânico": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-TcBDGf5BttKer5kZ3psf87bmyFMN9QwAEJ8ckNF8PA&s=10",
  "Motorista": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTZTeDCImdVGvuGAi6bGsNSDJM-vyyPxq-_lBRLJj0m1w&s=10",
  "Música": "https://www.infoescola.com/wp-content/uploads/2021/04/concerto_290796539.jpg",
  "Pedreiro": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT16qPMh3QFOLSS-2iC0q8rnddwRFUCERF4NveGMU8F-u4aeWRQ5hClEhI&s=10",
  "Pintor": "https://cdn.pixabay.com/photo/2022/06/08/15/21/artist-7250697_1280.jpg",
  "Professor Particular": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXO6RKfASn0ZZZmjmh9O7xvs5TphHvJEOug_HlwrTS9BZs7NDe8M3yBmcV&s=10",
  "Redator": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTp4eRQIGAJlatqbH5QDlQrZDEdCh81R4zyODN_RwTDtADj0CZuNDaO2xjp&s=10",
  "Segurança Eletrônica": "https://segware.com/wp-content/uploads/2024/04/Operacoes-de-Servicos-de-Seguranca-eficientes-1024x576.jpg",
  "Serralheiro": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSwFyPN2u7-4w4ukqvYBSe4LW2QymUL5rQm-xLVfOD0IceZHNAmSMj4Pb2g&s=10",
  "Social Media": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTX5COmj7CjNESyZ1Q1dM_HdKqTMuSTRfkVp-UaNlBLsw&s=10",
  "Técnico de Celular": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxEGcu_saDF1nReA9yOYwUy5T5BKcIkjOJMp4TxH3s7Z_zidfQfpqnUZFr&s=10",
  "Técnico de Informática": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRszTHWIX0Cfu2RpSg4KRClCqNpEjD2_MlrPC8oA-BCPQ&s=10",
  "Técnico em Refrigeração": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuWBsRd4ZiF7qoqkzZvDfoA5EXDQHWm3K5-fEH1BRX8t1v0yWiDSFivMy6&s=10",
  "Topografia": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRbCDjmDMVeh3r8TGyJ9WFiPe_LQ-JLTLSy5F_QZHvaHDkltRDGdS7GXMIa&s=10",
  "Tradutor": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSkU_Xe36VpCzJyZjgvNke0OyEvpCF0rr-ANBE4iDdWT9YEjfUucNiebln0&s=10",
  "Videomaker": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNijYkjDvCfHczVsP2uztuL0qjMJxbsRCPwdftMvPKX5ssxPkzA2ZD4LYe&s=10"
});
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  const indexed = new Map(Object.entries(URLS).map(([name,url]) => [normalize(name),url]));
  const get = name => indexed.get(normalize(name)) || null;
  const entries = Object.freeze(Object.entries(URLS).map(([name,image_url]) => Object.freeze({name,image_url})));
  scope.SQFOriginalCategoryImages = Object.freeze({get, count: indexed.size, entries});
})(typeof window === 'undefined' ? globalThis : window);
