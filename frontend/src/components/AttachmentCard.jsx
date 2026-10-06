import { useEffect, useState } from "react";
import { File, ExternalLink, Download } from "lucide-react";
import { apiBlob, apiDownload } from "../services/api";

export default function AttachmentCard({ file, token, notify, large = false }) {
  const [source, setSource] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [error, setError] = useState(false);
  const isImage = file.mimeType?.startsWith("image/");
  useEffect(() => {
    if (!isImage) return;
    let active = true;
    let url;
    let safeView;
    setSource(""); setViewUrl(""); setError(false);
    apiBlob(`/attachments/${file.id}/download`, { token }).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob); setSource(url);
      // SVG pode conter scripts se navegado diretamente. Como imagem em uma
      // página isolada ele continua visualizável e pode ser salvo com botão direito.
      if (file.mimeType === "image/svg+xml") {
        const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob:; style-src 'unsafe-inline'; sandbox"><title>Imagem anexada</title><style>body{margin:0;background:#202124;display:grid;place-items:center;min-height:100vh}img{max-width:100%;height:auto}</style><img src="${url}" alt="Imagem anexada">`;
        safeView = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      }
      setViewUrl(safeView || url);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); if (safeView) URL.revokeObjectURL(safeView); };
  }, [file.id, token, isImage]);
  const content = <><span className="attachment-preview">{source ? <img src={source} alt={file.originalName} /> : <File />}</span><span className="attachment-caption"><strong>{file.originalName}</strong><small>{error ? "Não foi possível carregar a imagem" : `${Math.ceil(file.size / 1024)} KB${isImage ? " · Abrir imagem" : " · Baixar arquivo"}`}</small></span>{isImage ? <ExternalLink /> : <Download />}</>;
  const className = `attachment-card ${large ? "attachment-large" : ""} ${isImage ? "image-attachment" : ""}`;
  // URL blob autenticada: não expõe token na URL e abre sem Content-Disposition de download.
  if (isImage) return <a className={className} href={viewUrl || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!viewUrl} onClick={event => { if (!viewUrl) { event.preventDefault(); notify?.(error ? "Reabra a atividade para tentar carregar a imagem novamente." : "A imagem ainda está carregando.", "error"); } }}>{content}</a>;
  return <button className={className} onClick={() => apiDownload(`/attachments/${file.id}/download`, { token, filename: file.originalName }).catch(error => notify?.(error.message, "error"))}>{content}</button>;
}
