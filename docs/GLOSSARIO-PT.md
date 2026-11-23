# Glossário da tradução para o português (pt-BR)

Termos usados nas rubricas e na interface da página do Próprio (`js/i18n-pt-BR.js`), para que todas as
traduções falem a mesma língua. A referência de vocabulário é o **Missal Quotidiano** de D. Beda
Keckeisen, OSB (6.ª ed., Mosteiro de S. Bento da Bahia, 1947), com a ortografia atualizada
(ele, coro, Jesus, desse, em vez de êle, côro, Jesús, dêsse).

O missal explica as cerimônias aos fiéis; as rubricas do app orientam o coro. Por isso a tradução
segue o vocabulário e o jeito de dizer do missal, mas não copia as suas frases.

## Pessoas

| Inglês | Português | Observação |
|---|---|---|
| Celebrant | Celebrante | Maiúscula quando o original usa maiúscula |
| Priest / priest | Sacerdote / sacerdote | |
| Deacon / Sub-deacon | Diácono / Subdiácono | |
| sacred ministers | ministros sagrados | |
| servers | acólitos | |
| assistant clergy | clero assistente | |
| cross bearer | cruciferário | |
| thurifer | turiferário | |
| cantor(s) | cantor(es) | |
| choir; first / second choir | coro; primeiro / segundo coro | "o coro, fora da igreja" (Ramos) |
| the faithful / congregation | os fiéis / todo o povo | |

## Objetos e lugares

| Inglês | Português |
|---|---|
| thurible; to put incense into the thurible | turíbulo; pôr incenso no turíbulo |
| catafalque | catafalco |
| altar of repose | altar da reposição |
| high altar | altar-mor |
| Epistle side | lado da Epístola |
| baptismal font | fonte batismal |
| paschal candle | círio pascal |
| palms; branches of olive | palmas; ramos de oliveira |
| candles (Candlemas) | velas |
| the foot of the Cross (door, Palm Sunday) | a haste da Cruz |

## Ações

| Inglês | Português |
|---|---|
| intones | entoa |
| sings alone | canta sozinho |
| respond in turn / alternately | respondem alternadamente |
| is repeated / repeat | repete-se |
| kneel / all kneel | ajoelham-se / todos se ajoelham |
| all rise | todos se levantam |
| genuflects | faz genuflexão |
| makes reverence / bow | faz a devida reverência |
| blesses (palms, incense, font) | benze |
| unveils the Cross | descobre a Cruz |
| stripping of the altars | desnudação dos altares |
| washing of the feet | lava-pés |
| imposition of the ashes | imposição das cinzas |
| in a higher tone / key | num tom mais alto |
| as far as … (exclusive) | até … (exclusive) |
| doubled (invocations of the litany) | repetida (cada invocação) |

## Partes e cerimônias

| Inglês | Português |
|---|---|
| Reproaches | Impropérios |
| adoration of the Cross | adoração da Cruz |
| Mass of the Pre-sanctified | Missa dos Pré-santificados |
| Responsory | Responsório |
| Versicles and Responses | versículos e respostas |
| ferial tone (of the Preface) | tom ferial (do Prefácio) |
| Lesson; Prophecies | Lição; Profecias |
| Collect | coleta |
| Gradual; Tract | Gradual; Trato |
| Terce; Lauds; Vespers; Matins | Terça; Laudes; Vésperas; Matinas |
| Little Chapter | Capítulo |
| last ablution | última ablução |
| Ferias in Lent | férias da Quaresma |
| Asperges | Aspersão |
| Absolution (after a Requiem) | Absolvição |
| The Paschal Praise (Exsultet) | o Louvor da Páscoa |
| stanza (of a hymn) | estrofe |

## Regras

- O **latim** fica sempre em latim: as citações entre `< >` (ex.: `<Ecce lignum Crucis.>`), os
  nomes das partes (Introitus, Graduale, Kyrie…) e os nomes dos cantos.
- As marcas `v/.` e `r/.` (℣ e ℟) ficam iguais.
- "Show"/"Hide" podem ser traduzidos: o `propers.js` compara o botão dos cantos extras com
  `I18n.t('Show')`.

## Nomes dos dias (menus)

- Base: calendário e índice dos santos do Missal (PDF 26–40 e 1374–1377), com a ortografia
  atual (Inês, Brás, Luís, Tomás em vez de Inez, Braz, Luiz, Tomaz).
- Santos por extenso: **São** / **Santo** (antes de vogal ou H: Santo Antônio, Santo Hilário) /
  **Santa**; vários santos: "São Fabiano e São Sebastião" ou "Santos Nereu, Aquileu…".
- Nossa Senhora (não "B.V.M."): "Assunção de Nossa Senhora", "Imaculado Coração de Maria".
- Domingos: "1.º Domingo do Advento", "10.º Domingo depois de Pentecostes"; semanas da
  Quaresma: "Segunda-feira da 1.ª semana da Quaresma"; Têmporas: "Quarta-feira das Têmporas…".
- Datas: "5 jan.", "23 ou 24 fev.", meses jan. fev. mar. abr. maio jun. jul. ago. set. out. nov.
  dez.; festa transferida: "(5 abr. 2027)". "(pre 1955)" → "(antes de 1955)".
- No modo **Português (dias em latim)**, os nomes vêm do campo `title` do `propersdata.js` (os
  dos santos foram escritos no estilo dos cabeçalhos do Missale Romanum: *S Telesphori Papæ et
  Mart*); só as datas ficam em português.
