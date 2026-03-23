## 🎯 Objective

Call:
https://example.com/api/:order_id

Filter:
symbol = TSLA

Output:
./output.txt

---

## Assumption & Interpretation

The requirement mentions “submit a HTTP GET request with order IDs” which may imply a single request. However, the endpoint format `https://example.com/api/:order_id` indicates a REST-style path parameter that typically operates on **a single resource per request**.

**Given that multiple records match `symbol == "TSLA"`, I assume the expected behavior is to issue one request per matching order_id.** With this assumption, I will write the a single-line command to execute multiple requests, each containing a order_id of symbols TLSA.

---

## Solution

```bash
jq -r 'select(.symbol=="TSLA") | .order_id' ./transaction-log.txt | xargs -I {} curl -s "https://example.com/api/{}" > ./output.txt
```

---

## Notes

- jq for JSON parsing
- xargs for batching
- parallel execution improves speed