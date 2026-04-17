import fmt from "@/lib/format";
test("formatIsoDate basic",()=>{ expect(fmt.formatIsoDate("2025-10-17")).toMatch(/[0-9]{2}\s\w{3}\s20[0-9]{2}/) })
test("formatStage map",()=>{ expect(fmt.formatStage("Second reading")).toBe("Second reading") })
