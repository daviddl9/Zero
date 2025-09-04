import { useQuery, useMutation } from '@tanstack/react-query';
import { useTRPC } from '../providers/query-provider';
import { useMemo } from 'react';

export interface ComposioConnection {
    id: string;
    userId: string;
    toolkit: string;
    status: 'connected' | 'error';
    authorizedAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface ComposioToolkit {
    name: string;
    description: string;
    toolCount: number;
    icon?: string;
}

export function useComposioConnections() {
    const trpc = useTRPC();

    const { data: toolkitsData, isLoading: toolkitsLoading } = useQuery(
        trpc.composioConnections.toolkits.queryOptions(),
    );

    const toolkits = useMemo(() => {
        return (toolkitsData?.toolkits || []).map((toolkit) => ({
            ...toolkit,
            icon: getToolkitIcon(toolkit.name),
        }));
    }, [toolkitsData]);

    const {
        data: connections,
        isLoading: connectionsLoading,
        refetch,
    } = useQuery(trpc.composioConnections.list.queryOptions());

    const { mutateAsync: getAuthUrl } = useMutation(
        trpc.composioConnections.getAuthUrl.mutationOptions(),
    );

    const { mutateAsync: authorizeToolkit } = useMutation({
        mutationFn: async (toolkit: string) => {
            const result = await getAuthUrl({ toolkit });
            return result;
        },
    });

    const { mutateAsync: revokeAuthorization } = useMutation(
        trpc.composioConnections.revoke.mutationOptions(),
    );

    return {
        toolkits,
        connections: connections?.connections || [],
        isLoading: connectionsLoading || toolkitsLoading,
        refetch,
        authorizeToolkit,
        revokeAuthorization,
    };
}

function getToolkitIcon(toolkit: string): string {
    const icons: Record<string, string> = {
        github: 'github',
        stripe: 'stripe',
        linear: 'linear',
    };

    return icons[toolkit.toLowerCase()] || 'default';
}
