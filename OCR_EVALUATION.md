# OCR Evaluation Notes

Run date: 2026-06-27

## PaddleOCR model fetch timing

The app overrides PaddleOCR.js' default PP-OCRv5 mobile model URLs with same-origin assets under `public/vendor/paddleocr`.

PaddleOCR.js default model URLs, found in `node_modules/@paddleocr/paddleocr-js/dist/index.mjs`:

- Detector: `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar`
- Recognizer: `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar`

Current app model URLs:

- Detector: `https://astanb.github.io/ocr-poc/vendor/paddleocr/PP-OCRv5_mobile_det_onnx_infer.tar`
- Recognizer: `https://astanb.github.io/ocr-poc/vendor/paddleocr/PP-OCRv5_mobile_rec_onnx_infer.tar`

Measured from the project machine with `curl -L -o /dev/null`:

| Asset | Source | Size | Total download time |
| --- | --- | ---: | ---: |
| PP-OCRv5 mobile detector | self-hosted GitHub Pages | 4,843,520 bytes | 0.72s |
| PP-OCRv5 mobile recognizer | self-hosted GitHub Pages | 16,701,440 bytes | 2.08s |
| PP-OCRv5 mobile detector | PaddleOCR.js default Baidu BOS URL | 4,843,520 bytes | 52.61s |
| PP-OCRv5 mobile recognizer | PaddleOCR.js default Baidu BOS URL | 16,701,440 bytes | 72.20s |

Conclusion: self-hosting does substantially reduce first-use model download time from this location. The first Paddle run can still be slow because it also initializes the runtime and creates ONNX sessions. The app now reports one-time `setup` time separately from per-attempt `OCR` time so cold and warm Paddle runs can be compared in the browser after processing.
