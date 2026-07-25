export function parseSseChunk(chunk: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const parts = chunk.split('\n\n').filter(Boolean);

  for (const part of parts) {
    const lines = part.split('\n');
    let event = 'message';
    let dataLine = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLine += line.slice(5).trim();
      }
    }

    if (!dataLine) {
      continue;
    }

    events.push({
      event,
      data: JSON.parse(dataLine) as unknown,
    });
  }

  return events;
}
