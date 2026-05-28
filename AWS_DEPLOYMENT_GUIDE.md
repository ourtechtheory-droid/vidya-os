# VidyaOS AWS Deployment Guide

This guide details two standard paths to deploy the VidyaOS stack (FastAPI Backend + React Frontend + MongoDB Database) on AWS:
1. **Option A (Recommended for Simplicity & Low Cost)**: Single EC2 Ubuntu Instance running an Nginx reverse proxy, systemd backend services, and a MongoDB Atlas managed database.
2. **Option B (Recommended for Production & High Scale)**: Serverless static hosting (AWS S3 + CloudFront) with a serverless containerized backend (AWS App Runner) and MongoDB Atlas.

---

## 🏗️ Deployment Architecture (Option A)

```mermaid
graph TD
    User([User Browser]) -- HTTPS (Port 443) --> Nginx[Nginx Reverse Proxy]
    Nginx -- Static Routing --> StaticFE[React Static Files /var/www/html]
    Nginx -- Reverse Proxy (Port 8001) --> FastAPI[FastAPI Backend / Uvicorn]
    FastAPI -- Secure Connection --> MongoDB[(MongoDB Atlas Cloud)]
```

---

## 🗄️ Step 0: Set Up MongoDB Database (MongoDB Atlas)

Since MongoDB is required, hosting it on MongoDB Atlas (managed cloud service) is the most reliable, secure, and cost-effective approach.

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and register for a free account.
2. Click **Create Database** -> Choose the **M0 Shared Free Tier** -> Choose your preferred AWS region.
3. In **Security Quickstart**:
   * Create a database user (e.g. `vidya_admin`) and generate a secure password.
   * Add `0.0.0.0/0` under **Network Access** to allow connection from AWS (or whitelist the EC2 IP once provisioned).
4. Click **Database** -> **Connect** -> Choose **Drivers** (Python).
5. Copy the connection string. It looks like:
   `mongodb+srv://vidya_admin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`

---

## 🚀 Option A: Single EC2 Instance + Nginx Setup (Easiest & Most Popular)

### Step 1: Provision your EC2 Instance
1. Open the **AWS Console** and navigate to **EC2** -> **Launch Instance**.
2. **Name**: `vidya-os-server`.
3. **OS**: **Ubuntu Server 24.04 LTS** (HVM), SSD Volume Type.
4. **Instance Type**: `t3.small` (2 vCPUs, 2 GiB RAM recommended for building/running Node assets) or `t3.micro` (free-tier eligible).
5. **Key Pair**: Create a new `.pem` key pair or select an existing one to access the server via SSH.
6. **Network Settings (Security Group)**:
   * [x] **Allow SSH traffic** (Port 22)
   * [x] **Allow HTTPS traffic** (Port 443)
   * [x] **Allow HTTP traffic** (Port 80)
7. Launch the instance.

### Step 2: Access your EC2 Server & Install Dependencies
From your terminal, SSH into your server (using the IP address of your EC2 instance):
```bash
ssh -i "your-key.pem" ubuntu@<ec2-public-ip-address>
```

Once logged in, update the package manager and install Node.js, Python, Nginx, and Git:
```bash
sudo apt update && sudo apt upgrade -y

# Install Python and Venv tools
sudo apt install python3-pip python3-venv python3-dev build-essential git nginx -y

# Install Node.js (LTS v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install --global yarn
```

### Step 3: Clone Code & Configure Environment
Clone your repository into the `/var/www` directory:
```bash
sudo chown -R ubuntu:ubuntu /var/www
cd /var/www
git clone https://github.com/ourtechtheory-droid/vidya-os.git
cd vidya-os
```

#### 1. Setup Backend Environment:
```bash
cd /var/www/vidya-os/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` configuration file in `/var/www/vidya-os/backend/.env`:
```bash
nano .env
```
Add the following content (replacing with your MongoDB Atlas details):
```env
MONGODB_URI=mongodb+srv://vidya_admin:<password>@cluster0.xxxx.mongodb.net/vidya_db?retryWrites=true&w=majority
JWT_SECRET=super-secure-random-string-generate-your-own
PORT=8001
HOST=0.0.0.0
```
*(Press `Ctrl+O` then `Enter` to save, and `Ctrl+X` to exit nano)*

#### 2. Setup Frontend Environment & Build:
```bash
cd /var/www/vidya-os/frontend
```
Create a `.env` configuration file in `/var/www/vidya-os/frontend/.env`:
```bash
nano .env
```
Add the server API path:
```env
REACT_APP_API_URL=https://api.yourdomain.com
```
Now install dependencies and compile the production build:
```bash
yarn install
yarn build
```
This compiles your static assets into the `/var/www/vidya-os/frontend/build` folder.

---

### Step 4: Configure Backend Systemd Daemon
Create a system service file so that your FastAPI python app runs automatically in the background and restarts on system boot.

```bash
sudo nano /etc/systemd/system/vidya-backend.service
```

Paste the following service definition:
```ini
[Unit]
Description=VidyaOS FastAPI Backend Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/vidya-os/backend
ExecStart=/var/www/vidya-os/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
EnvironmentFile=/var/www/vidya-os/backend/.env

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable vidya-backend
sudo systemctl start vidya-backend
```

Check the status to ensure it's active:
```bash
sudo systemctl status vidya-backend
```

---

### Step 5: Configure Nginx Reverse Proxy & Static Hosting
Nginx will handle routing traffic: standard static files will serve the React build, and `/api` requests will reverse-proxy directly to port `8001`.

Create an Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/vidya-os
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com; # Replace with your real domain or EC2 Public IP

    # React frontend static files
    location / {
        root /var/www/vidya-os/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # FastAPI backend proxy routing
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/vidya-os /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default # Remove default Nginx welcome page
sudo nginx -t # Validate syntax
sudo systemctl restart nginx
```

---

### Step 6: Secure with Free SSL (Let's Encrypt / Certbot)
To run over secure HTTPS, automate your SSL certificates with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Follow the interactive prompts to secure your domain. Nginx will automatically reload with fully valid SSL configurations and redirect HTTP requests to HTTPS!

---

## ⚡ Option B: Modern Serverless Stack (Highly Scalable)

If you prefer a managed serverless architecture without maintaining EC2 systems:

### 1. Frontend (S3 + CloudFront CDN)
* **S3 Bucket**: Create an AWS S3 bucket named `vidya-os-frontend`, check the properties to enable **Static Website Hosting**, and upload your `/frontend/build/` static folder content.
* **CloudFront**: Create a CloudFront Distribution pointing to your S3 bucket website endpoint.
  * Select **Redirect HTTP to HTTPS**.
  * Use **ACM (AWS Certificate Manager)** to issue a free SSL certificate for your domain.

### 2. Backend (AWS App Runner)
AWS App Runner automatically pulls your code from GitHub, builds your python container, and serves it on an HTTPS endpoint with built-in auto-scaling.
* Go to the **AWS App Runner Console** -> **Create Service**.
* **Repository**: Connect your GitHub repository and select the `main` branch.
* **Deployment Trigger**: Automatic (deploys every time you push to main!).
* **Runtime**: Choose **Python 3**.
* **Build Command**: `pip install -r requirements.txt`
* **Start Command**: `uvicorn server:app --host 0.0.0.0 --port 8080`
* **Environment Variables**: Define your `MONGODB_URI` and `JWT_SECRET` keys inside the console properties.
* App Runner will output a secure URL (e.g. `https://xxxxxx.us-east-1.awsapprunner.com`). Update your React configuration's `REACT_APP_API_URL` to point to this endpoint.
