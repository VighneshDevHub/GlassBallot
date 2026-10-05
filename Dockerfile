FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV GB_DATA_DIR=/data
EXPOSE 5000
# Demo build: binds to all interfaces inside the container. Set GB_DEMO=0 and GB_ADMIN_PASSWORD for anything real.
CMD ["python", "-c", "from app import create_app; create_app().run(host='0.0.0.0', port=5000, threaded=True)"]
