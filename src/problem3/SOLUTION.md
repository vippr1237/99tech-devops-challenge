## 🚨 Problem summary

A virtual machine (VM), running Ubuntu 24.04, with 64GB of storage is consistently running at 99% storage usage recently. This VM is responsible for only running one service - a NGINX load balancer as a traffic router for upstream services. 

---

## 1. Initial investigation

Goal: Quickly identify the mount points and file system that get affected, then quickly narrow down the cause of the issue.

First, verify the alert and locate the affected filesystem:

```
df-h
df-i
lsblk
```

- Identify which mount point is full (e.g., `/`, `/var`)
- Check if it’s **disk space vs inode exhaustion**

Then locate where space is being used:

```
sudo du-xh /--max-depth=12>/dev/null |sort-hr
sudo du-xh /var--max-depth=22>/dev/null |sort-hr | head
```

If `/var` is large → issue might relate to logs:

```
sudo du-sh /var/log/nginx/*
```

Check hidden usage (deleted files still open):

```
sudo lsof+L1
```

If  `/home` is large → developer access VM and accidentally cause the storage to full

If  other directories → issue related to Ubuntu patching and Nginx

Detail impacts and recovery steps for each scenarios will be describe below.

## 2. Expected scenarios, impacts, and recovery steps

---

### Scenario 1 — NGINX access logs filling disk (most likely)

**Cause**

Traffic increase → `/var/log/nginx/access.log` grows continuously (no rotation or high volume)

**Impact**

- Disk reaches 100% → system instability
- NGINX may fail to write logs
- Other services may fail (SSH, package manager, temp files)

**Recovery**

Immediate:

```
truncate-s0 /var/log/nginx/access.log
```

Long-term:

- Configure `logrotate`
- Reduce logging (exclude health checks, sampling)
- Ship logs to centralized system

---

### Scenario 2 — NGINX error log explosion (upstream issues)

**Cause**

Upstream services failing → NGINX logs massive errors

**Impact**

- Disk fills rapidly
- Traffic likely already degraded
- Error log becomes both symptom and problem

**Recovery**

Immediate:

```
truncate-s0 /var/log/nginx/error.log
```

Then:

- Fix upstream connectivity (timeouts, DNS, service health)
- Reduce log verbosity if needed

---

### Scenario 3 — Nginx recent release

**Cause**

Nginx recent release cause the log increase or log rotation fail

**Impact**

- Disk fills rapidly

**Recovery**

Check Github issue and revert to previous running version or apply hotfix provided by Nginx

---

### Scenario 4 — Developer access VM and accidentally make disk full

**Cause**

- Developer was grant access to VM and use it carelessly, then accidentally cause the storage to full

**Impact**

- Disk full without head up

**Recovery**

Check whom folder was causing the issue, clarify if the data is important, zip and move to local.

---

### Scenario 5 — Deleted files still consuming disk

**Cause**

Logs deleted manually but still held by NGINX process

**Impact**

- Disk remains full even after cleanup
- Hard to detect without proper tools

**Recovery**

```
systemctlrestart nginx
```

Long-term:

- Use proper log rotation (avoid manual `rm`)
- Ensure `postrotate` reload is configured

---

### Scenario 6 — Log rotation missing or misconfigured

**Cause**

Logs grow over time without rotation

**Impact**

- Gradual disk exhaustion
- Issue will recur even after manual cleanup

**Recovery**

- Clean up logs manually
- Fix `/etc/logrotate.d/nginx` (daily rotation, compression, retention)

---

### Scenario 7 — System logs / cache / temp files

**Cause**

- Journald logs
- APT cache
- `/tmp` files

**Impact**

- Gradual disk usage increase
- Less likely to spike suddenly

**Recovery**

```
journalctl--vacuum-size=500M
apt clean
```

Long-term:

- Set journald retention limits
- Periodic cleanup

---

## Summarize Troubleshooting Process

- **Fast validation → locate disk usage**
- **Prioritize most likely cause (NGINX logs)**
- **Free space safely without breaking service**
- **Identify root cause**
- **Apply long-term prevention (log rotation, monitoring, centralized logging)**