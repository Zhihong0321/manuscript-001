FROM node:20-alpine

# Install nginx
RUN apk add --no-cache nginx

# ─── API setup ───
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/server.js ./

# ─── Nginx setup ───
RUN rm -f /etc/nginx/http.d/default.conf
COPY nginx.conf /etc/nginx/http.d/default.conf

# ─── Static files ───
RUN mkdir -p /usr/share/nginx/html
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY image/ /usr/share/nginx/html/image/
COPY admin/ /usr/share/nginx/html/admin/

# ─── Start script ───
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
