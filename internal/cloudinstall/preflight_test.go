package cloudinstall

import "testing"

func TestPreflightCause(t *testing.T) {
	cases := []struct {
		name string
		fill func(r *PreflightResult)
		want BlockCause
	}{
		{"nothing blocking", func(r *PreflightResult) {}, ""},
		{"only denials", func(r *PreflightResult) {
			r.blockDenied("create ClusterRole \"radar\": forbidden")
			r.blockDenied("create Deployment \"radar\": forbidden")
		}, BlockCausePermissions},
		{"a refusal outranks denials", func(r *PreflightResult) {
			r.blockDenied("create ClusterRole \"radar\": forbidden")
			r.blockRefused("create Deployment \"radar\": an object already exists but is not owned by the current Helm release")
		}, BlockCauseCluster},
		{"a refusal outranks unverifiable", func(r *PreflightResult) {
			r.blockUnverifiable("inspect rendered chart Secrets: hidden")
			r.blockRefused("map target Helm manifest to this cluster: no matches for kind")
		}, BlockCauseCluster},
		{"only unverifiable", func(r *PreflightResult) {
			r.blockUnverifiable("inspect rendered chart Secrets: hidden")
		}, BlockCauseVerification},
		{"denial outranks unverifiable", func(r *PreflightResult) {
			r.blockUnverifiable("inspect rendered chart Secrets: hidden")
			r.blockDenied("create Secret \"radar\": forbidden")
		}, BlockCausePermissions},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var r PreflightResult
			tc.fill(&r)
			if got := r.Cause(); got != tc.want {
				t.Fatalf("Cause() = %q, want %q (blocking=%v denied=%v unverifiable=%v)", got, tc.want, r.Blocking, r.Denied, r.Unverifiable)
			}
			if len(r.Denied)+len(r.Unverifiable) > len(r.Blocking) {
				t.Fatalf("subsets larger than Blocking")
			}
		})
	}
}
