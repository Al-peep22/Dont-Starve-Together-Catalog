const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement(tagName) {
    return {
        tagName,
        children: [],
        textContent: "",
        append(...nodes) {
            this.children.push(...nodes);
        }
    };
}

function content(node) {
    return node.textContent + (node.children || []).map(content).join("");
}

const script = fs.readFileSync(path.join(
    __dirname, "..", "DontStarveTogetherCatalog", "frontend", "js", "catalog.js"
), "utf8");
const context = vm.createContext({
    document: {
        querySelector: () => null,
        createElement,
        createTextNode: text => ({ textContent: text })
    }
});
vm.runInContext(script, context);

test("empty values render as N/A while zero and false remain visible", () => {
    for (const value of [null, undefined, "", "   ", [], {}]) {
        assert.equal(content(context.renderValue(value)), "N/A");
    }
    assert.equal(content(context.renderValue(0)), "0");
    assert.equal(content(context.renderValue(false)), "false");
});

test("relationship arrays render relevance as bullet points", () => {
    const list = context.renderValue([
        { character_id: "wilson", relevance: "A scientist." },
        { character_id: "wendy", relevance: "A survivor." }
    ]);
    assert.equal(list.tagName, "ul");
    assert.deepEqual(list.children.map(child => child.tagName), ["li", "li"]);
    assert.deepEqual(list.children.map(content), [
        "wilson: A scientist.",
        "wendy: A survivor."
    ]);
});

test("nested objects render their fields instead of raw JSON", () => {
    const fields = context.renderValue({ health: null, hunger: 150 });
    assert.equal(fields.tagName, "dl");
    assert.deepEqual(fields.children.map(content), ["Health", "N/A", "Hunger", "150"]);
});
