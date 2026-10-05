import { rotations, rotateTable } from "../../src/core/cube.ts";
import { lines } from "../../src/core/classic.ts";
const rs = rotations(2);
const out: string[] = [];
out.push(`static const int NROT=${rs.length};`);
out.push(`static const int ROT[${rs.length}][24]={${rs.map(r=>"{"+rotateTable(2,r.axis,r.layer,r.dir).join(",")+"}").join(",")}};`);
const w = lines(2,2);
out.push(`static const int NW=${w.length};`);
out.push(`static const int WIN[${w.length}][2]={${w.map(c=>"{"+c.join(",")+"}").join(",")}};`);
// whole-cube quarter turns: x all layers dir1, y all layers dir1
const idx=(axis:string,layer:number,dir:number)=>rs.findIndex(r=>r.axis===axis&&r.layer===layer&&r.dir===dir);
out.push(`static const int GEN[2][2]={{${idx("x",0,1)},${idx("x",1,1)}},{${idx("y",0,1)},${idx("y",1,1)}}};`);
console.log(out.join("\n"));
