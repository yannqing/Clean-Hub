import assert from "node:assert/strict";
import { parseProductImportCsv } from "./product-import";

const branches = ["01KRERJN800000000000000001", "01KRERJN810000000000000002"];
const parse = (text: string) => parseProductImportCsv(text, branches, "XOF");
const valid = parse(
  '\uFEFFname,sale_price,sku_code,barcode\r\n"Soap, large",250,,12345\r\nShampoo,500,MY-SKU,99999\r\n',
);
assert.ok(valid.ok);
assert.equal(valid.products[0]!.product.skuCode, "");
assert.equal(valid.products[0]!.product.name, "Soap, large");
assert.equal(valid.products[1]!.product.skuCode, "MY-SKU");
assert.equal(valid.products[0]!.product.branchSettings.length, 2);
assert.equal(
  valid.products[0]!.product.taxRateId,
  null,
  "import uses the same tenant default tax policy as single creation",
);

function rejected(text: string, code: string, row?: number) {
  const result = parse(text);
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.ok(
      result.errors.some(
        (error) =>
          error.code === code && (row === undefined || error.row === row),
      ),
      JSON.stringify(result.errors),
    );
}
rejected("name,sale_price\n", "empty");
rejected('name,sale_price\n"unclosed,10', "malformed");
rejected('name,sale_price\n"closed"extra,10', "malformed");
rejected("name,sale_price\nSoap,1,extra", "malformed", 2);
rejected("name,name,sale_price\nA,B,1", "headers");
rejected("name,price\nA,1", "headers");
rejected("name,sale_price,typo\nA,1,x", "headers");
rejected("name,sale_price,sku_code\nA,1,SAME\nB,2,SAME", "skuCodeDuplicate", 3);
rejected("name,sale_price,barcode\nA,1,999\nB,2,999", "barcodeDuplicate", 3);
rejected("name,sale_price,track_inventory\nA,1,yes", "invalidBoolean", 2);
rejected("name,sale_price\nA,-1", "salePriceInvalid", 2);
rejected("name,sale_price,opening_stock\nA,1,1.5", "branchInventoryInvalid", 2);
rejected(
  "name,sale_price,track_inventory,opening_stock\nA,1,false,3",
  "branchInventoryInvalid",
  2,
);
rejected(
  'name,sale_price\n"line one\nline two",1\nB,-1',
  "salePriceInvalid",
  4,
);
rejected(
  "name,sale_price\n" + Array.from({ length: 101 }, () => "A,1").join("\n"),
  "tooMany",
);
assert.equal(
  parseProductImportCsv("name,sale_price\nA,1", [], "XOF").ok,
  false,
  "publishing branches are required",
);
console.log("Product CSV import smoke passed.");
