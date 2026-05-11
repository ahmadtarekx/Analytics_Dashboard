export function renderBold(text) {
  if (!text || typeof text !== 'string') return text;
  
  if (text.startsWith('###')) {
    const headerText = text.replace(/^###\s*/, '');
    return <strong style={{ fontSize: '1.1em', color: 'var(--accent2)' }}>{renderBold(headerText)}</strong>;
  }

  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}