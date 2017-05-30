global
        log 127.0.0.1   local0
        log 127.0.0.1   local1 notice
        stats timeout 30s
        daemon
        #debug
        #quiet

defaults
        log     global
        mode    http
        option  httplog
        option  dontlognull
        option  redispatch
        retries 3
        maxconn 2000
        timeout connect 50000
        timeout client  240000
        timeout server  240000

listen stats
        bind *:8080
        stats uri /
        stats enable
        stats auth me:password

listen namerd
        bind *:4180
        mode tcp
        option tcplog
        balance roundrobin

        {{range $index, $service := service "namerd-api-http"}}
        server {{.Name}}-{{$index}} {{.Address}}:{{.Port}} check{{end}}
        server namerd1 namerd1:4180 check
        server namerd2 namerd2:4180 check
        server namerd3 namerd3:4180 check
