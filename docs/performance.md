# TextEdit vs Edytka Performance Comparison

Compared opening the same large file in macOS TextEdit and Edytka.

File details:

- Size: 780 MB
- Lines: 29.3 million
- Both editors successfully opened the file

## Launch times

| Metric | TextEdit | Edytka |
| --- | --- | --- |
| App launch | 0.05s | 0.09s |
| Time to visible window | < 1s | < 1s |
| Full load time | ~10-15s | ~2-3s ✅ |

## Memory usage

| Metric | TextEdit | Edytka |
| --- | --- | --- |
| RAM % | 4.4% | 1.3% ✅ |
| Virtual memory | 5.8 GB | 1.7 GB ✅ |
| Memory efficiency | Poor | Much better ✅ |

## CPU usage

| Metric | TextEdit | Edytka |
| --- | --- | --- |
| Peak CPU | 100% | < 3% ✅ |
| Settle time | ~15s | ~3s ✅ |

## Verdict

Edytka is significantly more efficient:

- 3-5x faster load time (3s vs 15s)
- 3.3x less RAM usage (1.3% vs 4.4%)
- 3.4x less virtual memory (1.7 GB vs 5.8 GB)
- Much lower CPU spike (3% vs 100%)
- Snappier responsiveness during load

Winner: Edytka — clearly optimized for handling large files and the clear winner for editing massive Markdown documents on Mac.
