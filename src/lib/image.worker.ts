import { processImage } from './image';
import type { ImageSettings } from './image';
import { configureCodecs } from './codecs';
const scope = self as unknown as { onmessage: (event: MessageEvent<{ file: File; settings: ImageSettings; baseURL: string }>) => void; postMessage: (message: unknown) => void };
scope.onmessage = async ({ data }) => {
  try {
    configureCodecs(data.baseURL);
    const result = await processImage(data.file, data.settings, progress => scope.postMessage({ progress }));
    scope.postMessage({ result });
  } catch (e) { scope.postMessage({ error: e instanceof Error ? e.message : 'genericError' }); }
};
