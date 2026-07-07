import { createHash, randomBytes } from "node:crypto";

type DigestChallenge = {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
};

export class AtlasClient {
  private readonly authHeader: string;
  private readonly base = "https://cloud.mongodb.com/api/atlas/v2";

  constructor(publicKey: string, privateKey: string) {
    this.authHeader = `Basic ${Buffer.from(`${publicKey}:${privateKey}`).toString("base64")}`;
  }

  async get(path: string): Promise<unknown> {
    const url = `${this.base}${path}`;
    let res = await fetch(url, {
      headers: {
        Accept: "application/vnd.atlas.2024-10-23+json",
        Authorization: this.authHeader,
      },
    });

    if (res.status === 401) {
      const www = res.headers.get("www-authenticate");
      if (www?.toLowerCase().includes("digest")) {
        const challenge = parseDigestChallenge(www);
        const digest = buildDigestHeader("GET", path, challenge, this.authHeader);
        res = await fetch(url, {
          headers: {
            Accept: "application/vnd.atlas.2024-10-23+json",
            Authorization: digest,
          },
        });
      }
    }

    if (!res.ok) throw new Error(`Atlas API ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

function parseDigestChallenge(header: string): DigestChallenge {
  const parts = header.replace(/^Digest\s+/i, "").split(/,\s*/);
  const map: Record<string, string> = {};
  for (const p of parts) {
    const m = p.match(/^(\w+)="?([^"]+)"?$/);
    if (m) map[m[1]] = m[2];
  }
  return {
    realm: map.realm ?? "",
    nonce: map.nonce ?? "",
    qop: map.qop,
    opaque: map.opaque,
    algorithm: map.algorithm,
  };
}

function buildDigestHeader(method: string, path: string, c: DigestChallenge, basic: string): string {
  const userPass = Buffer.from(basic.replace(/^Basic\s+/, ""), "base64").toString("utf8");
  const [username, password] = userPass.split(":");
  const nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");
  const ha1 = md5(`${username}:${c.realm}:${password}`);
  const ha2 = md5(`${method}:${path}`);
  const qop = c.qop?.includes("auth") ? "auth" : undefined;
  const response = qop
    ? md5(`${ha1}:${c.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${c.nonce}:${ha2}`);

  let header = `Digest username="${username}", realm="${c.realm}", nonce="${c.nonce}", uri="${path}", response="${response}"`;
  if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (c.opaque) header += `, opaque="${c.opaque}"`;
  if (c.algorithm) header += `, algorithm=${c.algorithm}`;
  return header;
}

function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}
