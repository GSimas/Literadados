// Exportação de tabelas (spec CA-14.3, design D25): XLSX sem biblioteca, CSV com BOM, números em pt-BR.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { xlsx, csv, numeroBR } from "../web/exportar.js";

test("numeroBR: só números de verdade viram número", () => {
  assert.equal(numeroBR("713"), 713);
  assert.equal(numeroBR("1.234,5"), 1234.5);
  assert.equal(numeroBR("2,5"), 2.5);
  for (const t of ["39%", "2010–2025", "≥ 3,4%", "", "não coletada", "1.2.3"]) assert.equal(numeroBR(t), null, t);
});

test("csv: BOM, aspas e vírgulas escapadas", () => {
  assert.equal(csv([["nome", "obra"], ["Ana", 'Livro "A", vol. 1']]), '﻿nome,obra\r\nAna,"Livro ""A"", vol. 1"\r\n');
});

test("xlsx: ZIP válido (CRC conferido pelo Python) com cabeçalho em texto e números como números", () => {
  const arq = join(mkdtempSync(join(tmpdir(), "lit-")), "t.xlsx");
  writeFileSync(arq, xlsx([["UF", "Pessoas", "Nota & <obs>"], ["MG", "61", "acentuação ok"], ["SP", "1.234", "39%"]]));
  const py = `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
s=z.read("xl/worksheets/sheet1.xml").decode()
print(sorted(z.namelist())); print("<v>61</v>" in s, "<v>1234</v>" in s, "Nota &amp; &lt;obs&gt;" in s, ">39%<" in s, "acentuação" in s)`;
  const saida = execFileSync("python3", ["-c", py, arq], { encoding: "utf-8" }).trim().split("\n");
  assert.equal(saida[0], "['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']");
  assert.equal(saida[1], "True True True True True");
});
