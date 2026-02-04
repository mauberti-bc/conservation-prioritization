{{- /*
Base release name
*/ -}}
{{- define "conservation-tool.fullname" -}}
{{ .Release.Name }}
{{- end }}

{{- /*
Namespace
*/ -}}
{{- define "conservation-tool.namespace" -}}
{{- printf "%s-%s" .Values.environment.licensePlate .Values.environment.name }}
{{- end }}

{{- /* Global annotations */ -}}
{{- define "conservation-tool.annotations" -}}
helm.sh/chart: {{ include "conservation-tool.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- /*
App suffix
*/ -}}
{{- define "conservation-tool.suffix" -}}
{{- if and .Values.environment.id (eq (toString .Values.environment.id) "deploy") (eq .Values.environment.name "dev") }}
{{- printf "-%s-%s" .Values.environment.name (toString .Values.environment.id) | trunc 63 | trimSuffix "-" }}
{{- else if and .Values.environment.id (eq (toString .Values.environment.id) "deploy") (ne .Values.environment.name "dev") }}
{{- printf "-%s" .Values.environment.name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "-%s-%s" .Values.environment.name .Values.environment.changeId | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- /*
Prefect server fullname
*/ -}}
{{- define "conservation-tool.fullname.prefect-server" -}}
{{ include "conservation-tool.fullname" . }}-prefect-server
{{- end }}

{{- /*
Prefect worker fullname
*/ -}}
{{- define "conservation-tool.fullname.prefect-worker" -}}
{{ include "conservation-tool.fullname" . }}-prefect-worker
{{- end }}

{{- /*
Prefect deploy fullname
*/ -}}
{{- define "conservation-tool.fullname.prefect-deploy" -}}
{{ include "conservation-tool.fullname" . }}-prefect-deploy
{{- end }}

{{- /*
Frontend fullname
*/ -}}
{{- define "conservation-tool.fullname.frontend" -}}
{{ include "conservation-tool.fullname" . }}-frontend
{{- end }}

{{- /*
API fullname
*/ -}}
{{- define "conservation-tool.fullname.api" -}}
{{ include "conservation-tool.fullname" . }}-api
{{- end }}

{{- /*
DB fullname
*/ -}}
{{- define "conservation-tool.fullname.db" -}}
{{ include "conservation-tool.fullname" . }}-db
{{- end }}

{{- /*
Labels
*/ -}}
{{- define "conservation-tool.labels" -}}
app: {{ include "conservation-tool.fullname" . }}
env-id: {{ default "unknown" .Values.environment.id | quote }}
env-name: {{ default "unknown" .Values.environment.name | quote }}
env-ts: {{ default "unknown" .Values.environment.ts | quote }}
helm.sh/chart: {{ include "conservation-tool.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- /*
Chart name/version
*/ -}}
{{- define "conservation-tool.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- /*
Image tag helper for builds
*/ -}}
{{- define "conservation-tool.imageTag" -}}
{{- if and .Values.environment.id (eq (toString .Values.environment.id) "deploy") }}
{{- printf "build-%s-%s-%s" .Chart.AppVersion .Values.environment.changeId .Values.environment.name }}
{{- else }}
{{- printf "build-%s-%s" .Chart.AppVersion .Values.environment.changeId }}
{{- end }}
{{- end }}