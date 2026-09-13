package issues

import (
	"errors"
	"testing"

	"github.com/skyhook-io/radar/internal/k8s"
	"github.com/skyhook-io/radar/pkg/k8score"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	fakediscovery "k8s.io/client-go/discovery/fake"
	fakeclientset "k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

func TestKarpenterDiscoveryFailureDoesNotClaimNotInstalled(t *testing.T) {
	client := fakeclientset.NewSimpleClientset().Discovery().(*fakediscovery.FakeDiscovery)
	client.Resources = []*metav1.APIResourceList{{GroupVersion: "v1", APIResources: []metav1.APIResource{{Kind: "Pod", Name: "pods"}}}}
	d, err := k8score.NewResourceDiscovery(client)
	if err != nil {
		t.Fatal(err)
	}
	p := &CacheProvider{discovery: &k8s.ResourceDiscovery{ResourceDiscovery: d}}
	if got := p.karpenterResourceDiscovery("karpenter.sh", "NodePool"); got != karpenterCoverageNotInstalled {
		t.Fatalf("clean absence = %v", got)
	}
	client.PrependReactor("get", "group", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("discovery unavailable")
	})
	_ = d.Refresh()
	if got := p.karpenterResourceDiscovery("karpenter.sh", "NodePool"); got != karpenterCoverageUnknown {
		t.Fatalf("failed discovery = %v", got)
	}
	client.ReactionChain = client.ReactionChain[1:]
	if err := d.Refresh(); err != nil {
		t.Fatal(err)
	}
	if got := p.karpenterResourceDiscovery("karpenter.sh", "NodePool"); got != karpenterCoverageNotInstalled {
		t.Fatalf("recovered discovery = %v", got)
	}
}
