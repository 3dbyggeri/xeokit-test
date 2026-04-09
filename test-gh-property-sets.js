// test-gh-property-sets.js
// Usage (login mode):
//   node test-gh-property-sets.js --email "you@x.com" --password "secret" --projectId "69c591c54f558f000ff96a8a"
// Usage (direct token mode, like curl):
//   node test-gh-property-sets.js --token "PASTE_FULL_ACCESS_TOKEN_HERE" --projectId "69c591c54f558f000ff96a8a"
// Optional:
//   --server "app.glasshousebim.com"
//   --baseUrl "http://localhost:8080"

const axios = require("axios");

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function findMatchingPaths(value, keyMatcher, path = "$", acc = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => findMatchingPaths(item, keyMatcher, `${path}[${i}]`, acc));
    return acc;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      const childPath = `${path}.${key}`;
      if (keyMatcher(key)) {
        acc.push(childPath);
      }
      findMatchingPaths(child, keyMatcher, childPath, acc);
    });
  }
  return acc;
}

function collectConditionalColorSamples(propertySets, maxSamples = 8) {
  const samples = [];
  for (let setIndex = 0; setIndex < propertySets.length; setIndex++) {
    const set = propertySets[setIndex] || {};
    const properties = Array.isArray(set.properties) ? set.properties : [];
    for (let propIndex = 0; propIndex < properties.length; propIndex++) {
      const prop = properties[propIndex] || {};
      const rules = prop.conditional_formatting_rules;
      if (!rules || typeof rules !== "object") continue;

      for (const [ruleValue, ruleDef] of Object.entries(rules)) {
        const background = ruleDef?.background_color || null;
        const font = ruleDef?.font_color || null;
        samples.push({
          propertySetName: set.name || null,
          propertyName: prop.human_name || prop.original_name || prop.name || null,
          ruleValue,
          background_color: background,
          font_color: font,
          sourcePath: `property_sets[${setIndex}].properties[${propIndex}].conditional_formatting_rules["${ruleValue}"]`
        });
        if (samples.length >= maxSamples) return samples;
      }
    }
  }
  return samples;
}

function isHexColor(value) {
  if (!value) return false;
  const text = String(value).trim();
  return /^#?[0-9a-fA-F]{6}$/.test(text);
}

function resolveByPath(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function discoverConditionalFormattingShape(propertySets) {
  const propertyArrayCandidates = ["properties", "bim_properties"];
  const ruleContainerCandidates = [
    "conditional_formatting_rules",
    "conditional_formatting",
    "formatting_rules",
    "rules",
    "value_colors",
  ];
  const propertyNameCandidates = ["human_name", "original_name", "name", "display_name", "label", "title"];
  const propertyKeyCandidates = ["name", "original_name", "human_name", "id", "key", "guid"];
  const ruleValueCandidates = ["value", "name", "label", "match_value", "property_value", "text"];
  const colorCandidates = ["background_color", "color", "hex", "value_hex", "font_color"];

  const metrics = {
    propertyArrays: Object.fromEntries(propertyArrayCandidates.map((k) => [k, 0])),
    ruleContainers: Object.fromEntries(ruleContainerCandidates.map((k) => [k, 0])),
    propertyNames: Object.fromEntries(propertyNameCandidates.map((k) => [k, 0])),
    propertyKeys: Object.fromEntries(propertyKeyCandidates.map((k) => [k, 0])),
    ruleValueKeys: Object.fromEntries(ruleValueCandidates.map((k) => [k, 0])),
    colorKeys: Object.fromEntries(colorCandidates.map((k) => [k, 0])),
    validHexByColorKey: Object.fromEntries(colorCandidates.map((k) => [k, 0])),
    totalPropertiesScanned: 0,
    totalRulesScanned: 0,
  };

  propertySets.forEach((set) => {
    const discoveredArrayKey = propertyArrayCandidates.find((key) => Array.isArray(set?.[key]));
    if (!discoveredArrayKey) return;
    metrics.propertyArrays[discoveredArrayKey]++;

    const properties = set[discoveredArrayKey];
    properties.forEach((prop) => {
      metrics.totalPropertiesScanned++;

      propertyNameCandidates.forEach((key) => {
        if (prop?.[key] !== undefined && prop?.[key] !== null && String(prop[key]).trim() !== "") {
          metrics.propertyNames[key]++;
        }
      });
      propertyKeyCandidates.forEach((key) => {
        if (prop?.[key] !== undefined && prop?.[key] !== null && String(prop[key]).trim() !== "") {
          metrics.propertyKeys[key]++;
        }
      });

      const discoveredRuleKey = ruleContainerCandidates.find((key) => prop?.[key] && typeof prop[key] === "object");
      if (!discoveredRuleKey) return;
      metrics.ruleContainers[discoveredRuleKey]++;

      const rawRules = prop[discoveredRuleKey];
      const entries = Array.isArray(rawRules)
        ? rawRules.map((rule, idx) => [String(idx), rule])
        : Object.entries(rawRules);

      entries.forEach(([mapKey, ruleDef]) => {
        metrics.totalRulesScanned++;
        const ruleObj = ruleDef && typeof ruleDef === "object" ? ruleDef : {};
        ruleValueCandidates.forEach((key) => {
          if (ruleObj[key] !== undefined && ruleObj[key] !== null && String(ruleObj[key]).trim() !== "") {
            metrics.ruleValueKeys[key]++;
          }
        });
        colorCandidates.forEach((key) => {
          if (ruleObj[key] !== undefined && ruleObj[key] !== null && String(ruleObj[key]).trim() !== "") {
            metrics.colorKeys[key]++;
            if (isHexColor(ruleObj[key])) {
              metrics.validHexByColorKey[key]++;
            }
          }
        });

        if (mapKey && String(mapKey).trim() !== "") {
          metrics.ruleValueKeys["<map-key>"] = (metrics.ruleValueKeys["<map-key>"] || 0) + 1;
        }
      });
    });
  });

  const bestKey = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const recommended = {
    propertyArrayKey: bestKey(metrics.propertyArrays),
    ruleContainerKey: bestKey(metrics.ruleContainers),
    propertyNameKey: bestKey(metrics.propertyNames),
    propertyKeyKey: bestKey(metrics.propertyKeys),
    ruleValueKey: bestKey(metrics.ruleValueKeys),
    colorKey: bestKey(metrics.validHexByColorKey),
  };

  return { metrics, recommended };
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const tokenArg = arg("token");
  const projectId = arg("projectId");
  const server = arg("server", "app.glasshousebim.com");
  const baseUrl = arg("baseUrl", "http://localhost:8080");

  if (!projectId) {
    console.error("Missing required arg: --projectId");
    process.exit(1);
  }

  const hasLoginCreds = !!email && !!password;
  const hasToken = !!tokenArg;
  if (!hasToken && !hasLoginCreds) {
    console.error("Provide either --token OR (--email and --password), plus --projectId.");
    process.exit(1);
  }

  try {
    let apiKey = tokenArg;
    if (!apiKey) {
      console.log("1) Logging in via local backend...");
      const loginResp = await axios.post(
        `${baseUrl}/api/glasshouse/login`,
        { email, password, server },
        { timeout: 15000 }
      );

      apiKey = loginResp?.data?.apiKey;
      if (!apiKey) {
        console.error("Login succeeded but apiKey missing:", loginResp.data);
        process.exit(1);
      }
      console.log("   login ok, apiKey prefix:", `${apiKey.slice(0, 10)}...`);
    } else {
      console.log("1) Using provided token (direct token mode)...");
      console.log("   token prefix:", `${apiKey.slice(0, 10)}...`);
    }

    console.log("2) Fetching selected project property sets...");
    const url = `${baseUrl}/api/glasshouse/projects/${encodeURIComponent(
      projectId
    )}/property-sets?include_conditional_formatting=true&inspect_shape=true&server=${encodeURIComponent(
      server
    )}`;

    const propResp = await axios.get(url, {
      headers: { "access-token": apiKey },
      timeout: 20000,
    });

    const data = propResp.data || {};
    console.log("\n=== RESPONSE SUMMARY ===");
    console.log("success:", data.success);
    console.log("projectId:", data.projectId);
    console.log("shape:", JSON.stringify(data._payloadShape || null, null, 2));
    console.log("metadata:", JSON.stringify(data.metadata || null, null, 2));

    const sets = Array.isArray(data.property_sets) ? data.property_sets : [];
    console.log("property_sets count:", sets.length);
    if (sets.length > 0) {
      console.log("first property_set sample:");
      console.log(JSON.stringify(sets[0], null, 2));
    } else {
      console.log("No property_sets returned.");
    }

    const colorishKeys = /color|hex|conditional|format|rule|palette|style/i;
    const matchingPaths = findMatchingPaths(data, (key) => colorishKeys.test(key));
    console.log("\n=== CONDITIONAL/COLOR KEY SCAN ===");
    console.log("matching key-path count:", matchingPaths.length);
    if (matchingPaths.length > 0) {
      matchingPaths.slice(0, 40).forEach((p) => console.log(" -", p));
      if (matchingPaths.length > 40) {
        console.log(` ... and ${matchingPaths.length - 40} more`);
      }
    } else {
      console.log("No color/conditional/rule-like keys found in response payload.");
    }

    const colorSamples = collectConditionalColorSamples(sets, 8);
    console.log("\n=== CONDITIONAL COLOR VALUE SAMPLES ===");
    if (colorSamples.length === 0) {
      console.log("No conditional_formatting_rules with color values found.");
    } else {
      colorSamples.forEach((sample, i) => {
        console.log(
          `${i + 1}. ${sample.propertySetName} :: ${sample.propertyName} :: "${sample.ruleValue}" -> bg=${sample.background_color}, font=${sample.font_color}`
        );
      });
      console.log("sample source paths:");
      colorSamples.forEach((sample) => console.log(" -", sample.sourcePath));
    }

    const discovery = discoverConditionalFormattingShape(sets);
    console.log("\n=== SCHEMA DISCOVERY REPORT ===");
    console.log(JSON.stringify(discovery.metrics, null, 2));
    console.log("\n=== RECOMMENDED CANONICAL KEYS ===");
    console.log(JSON.stringify(discovery.recommended, null, 2));

    const hasRecommendation =
      discovery.recommended.propertyArrayKey &&
      discovery.recommended.ruleContainerKey &&
      discovery.recommended.propertyNameKey &&
      discovery.recommended.colorKey;

    if (!hasRecommendation) {
      console.error("\nSchema discovery did not find enough stable keys to lock runtime parser.");
      process.exit(2);
    }
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error("\nRequest failed.");
    console.error("status:", status || "N/A");
    console.error("body:", JSON.stringify(body || { message: err.message }, null, 2));
    process.exit(1);
  }
}

main();