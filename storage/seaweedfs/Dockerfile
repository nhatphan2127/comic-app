FROM chrislusf/seaweedfs:4.52

# 9333 master UI, 8888 filer UI, 8333 S3 API. init.sh publishes them on 127.0.0.1 only.
EXPOSE 8333 9333 8888

VOLUME ["/data"]

CMD ["mini", "-dir=/data"]
