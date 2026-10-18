import { processImage } from './image';
import type { ImageSettings } from './image';
const scope = self as unknown as { onmessage: (event: MessageEvent<{ file: File; settings: ImageSettings }>) => void; postMessage: (message: unknown) => void };
scope.onmessage = async ({ data }) => {
  try {
    const result = await processImage(data.file, data.settings, progress => scope.postMessage({ progress }));
    scope.postMessage({ result });
  } catch (e) { scope.postMessage({ error: e instanceof Error ? e.message : 'genericError' }); }
};
