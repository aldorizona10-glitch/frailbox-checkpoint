import{formatPrice,formatQuantity,formatVolume,formatPercent}from"../utils/formatters";

describe("formatPrice",()=>{
  it("returns dash for Infinity",(  )=>expect(formatPrice(Infinity)).toBe("-"));
  it("returns dash for -Infinity",()=>expect(formatPrice(-Infinity)).toBe("-"));
  it("returns dash for NaN",()=>expect(formatPrice(NaN)).toBe("-"));
  it("returns dash for null",()=>expect(formatPrice(null as any)).toBe("-"));
  it("uses 0 decimals for price>=10000",()=>{const r=formatPrice(15000);expect(r).not.toContain(".");});
  it("uses 2 decimals for price>=100",()=>{const r=formatPrice(250.5);expect(r.split(".")[1]?.length).toBe(2);});
  it("uses 4 decimals for price>=1",()=>{const r=formatPrice(1.5678);expect(r.split(".")[1]?.length).toBe(4);});
  it("uses 6 decimals for price>=0.01",()=>{const r=formatPrice(0.05);expect(r.split(".")[1]?.length).toBe(6);});
  it("handles price<0.0001",()=>expect(formatPrice(0.000001)).toBeTruthy());
  it("handles zero",()=>expect(formatPrice(0)).toBe("-"));
});

describe("formatQuantity",()=>{
  it("formats millions with M suffix",()=>{const r=formatQuantity(5000000);expect(r).toContain("M");});
  it("formats thousands with K suffix",()=>{const r=formatQuantity(5000);expect(r).toContain("K");});
  it("formats small qty without suffix",()=>{const r=formatQuantity(50);expect(r).not.toMatch(/[KMB]/);});
  it("returns dash for NaN",()=>expect(formatQuantity(NaN)).toBe("-"));
  it("returns dash for Infinity",()=>expect(formatQuantity(Infinity)).toBe("-"));
});

describe("formatVolume",()=>{
  it("formats billions with B suffix",()=>{const r=formatVolume(2000000000);expect(r).toContain("B");});
  it("formats millions with M suffix",()=>{const r=formatVolume(3000000);expect(r).toContain("M");});
  it("formats thousands with K suffix",()=>{const r=formatVolume(5000);expect(r).toContain("K");});
  it("returns dash for NaN",()=>expect(formatVolume(NaN)).toBe("-"));
  it("returns dash for zero",()=>expect(formatVolume(0)).toBe("-"));
});

describe("formatPercent",()=>{
  it("includes percent sign",()=>expect(formatPercent(5.5)).toContain("%"));
  it("includes + prefix for positive",()=>expect(formatPercent(3.2)).toContain("+"));
  it("includes - prefix for negative",()=>expect(formatPercent(-2.1)).toContain("-"));
  it("handles zero percent",()=>expect(formatPercent(0)).toBeTruthy());
  it("returns dash for NaN",()=>expect(formatPercent(NaN)).toBe("-"));
  it("returns dash for Infinity",()=>expect(formatPercent(Infinity)).toBe("-"));
});
