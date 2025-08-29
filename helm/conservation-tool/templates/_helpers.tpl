{{- define "web-app.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end }}

{{- define "web-app.fullname.prefect-server" -}}
{{ include "web-app.fullname" . }}-prefect-server
{{- end }}

{{- define "web-app.fullname.prefect-worker" -}}
{{ include "web-app.fullname" . }}-prefect-worker
{{- end }}

{{- define "web-app.fullname.frontend" -}}
{{ include "web-app.fullname" . }}-frontend
{{- end }}
