# 07 ライセンス

アプリ本体のコード・文章・SVG はこのリポジトリの成果物（星凪諸島・店・人・旅人の声はすべて架空）。

## 実行時の依存（Python、`uv.lock` で固定）
| パッケージ | 版 | ライセンス |
|---|---|---|
| fastapi | 0.115.6 | MIT |
| starlette | 0.41.3 | BSD-3-Clause |
| uvicorn | 0.34.0 | BSD-3-Clause |
| pydantic / pydantic-core | 2.10.4 / 2.27.2 | MIT |
| python-multipart | 0.0.20 | Apache-2.0 |
| h11 | 0.16.0 | MIT |
| typing-extensions | 4.16.0 | PSF |
| （開発）pytest 8.3.4 / httpx 0.28.1 / httpcore / idna / iniconfig / packaging / pluggy | | MIT / BSD / Apache-2.0 |

## 画面（Node、`package-lock.json` で固定。ビルド成果物は `frontend/dist`）
| パッケージ | 版 | ライセンス |
|---|---|---|
| react / react-dom | 18.3.1 | MIT |
| （開発）vite 5.4.11、@vitejs/plugin-react 4.3.4、typescript 5.6.3、vitest 2.1.8、@types/react, @types/react-dom | | MIT |

## ツール
Python 3.12（PSF）、uv（MIT/Apache-2.0）、Node.js（MIT）。グローバルに入れたのは Python と uv だけ。

フォント: システムフォントのみ（外部フォントなし）。画像: 自前 SVG のみ。
