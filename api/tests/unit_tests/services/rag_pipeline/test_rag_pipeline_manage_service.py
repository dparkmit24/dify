from types import SimpleNamespace

from pytest_mock import MockerFixture

from services.rag_pipeline.rag_pipeline_manage_service import RagPipelineManageService


def _declaration_with_credentials() -> SimpleNamespace:
    return SimpleNamespace(credentials_schema=[SimpleNamespace(name="api_key")], oauth_schema=None)


def test_list_rag_pipeline_datasources_marks_authorized(mocker: MockerFixture) -> None:
    datasource_1 = SimpleNamespace(
        provider="notion", plugin_id="plugin-1", is_authorized=False, declaration=_declaration_with_credentials()
    )
    datasource_2 = SimpleNamespace(
        provider="jina", plugin_id="plugin-2", is_authorized=False, declaration=_declaration_with_credentials()
    )

    manager_cls = mocker.patch("services.rag_pipeline.rag_pipeline_manage_service.PluginDatasourceManager")
    manager_cls.return_value.fetch_datasource_providers.return_value = [datasource_1, datasource_2]

    provider_cls = mocker.patch("services.rag_pipeline.rag_pipeline_manage_service.DatasourceProviderService")
    provider_instance = provider_cls.return_value
    provider_instance.get_datasource_credentials.side_effect = [
        {"access_token": "token"},
        None,
    ]

    result = RagPipelineManageService.list_rag_pipeline_datasources("tenant-1")

    assert result == [datasource_1, datasource_2]
    assert datasource_1.is_authorized is True
    assert datasource_2.is_authorized is False


def test_list_rag_pipeline_datasources_authorizes_providers_without_credentials(mocker: MockerFixture) -> None:
    local_file = SimpleNamespace(
        provider="file",
        plugin_id="langgenius/file",
        is_authorized=False,
        declaration=SimpleNamespace(credentials_schema=[], oauth_schema=None),
    )
    oauth_only = SimpleNamespace(
        provider="notion",
        plugin_id="plugin-1",
        is_authorized=False,
        declaration=SimpleNamespace(
            credentials_schema=[], oauth_schema=SimpleNamespace(credentials_schema=[SimpleNamespace(name="token")])
        ),
    )

    manager_cls = mocker.patch("services.rag_pipeline.rag_pipeline_manage_service.PluginDatasourceManager")
    manager_cls.return_value.fetch_datasource_providers.return_value = [local_file, oauth_only]

    provider_cls = mocker.patch("services.rag_pipeline.rag_pipeline_manage_service.DatasourceProviderService")
    provider_instance = provider_cls.return_value
    provider_instance.get_datasource_credentials.return_value = None

    result = RagPipelineManageService.list_rag_pipeline_datasources("tenant-1")

    assert result == [local_file, oauth_only]
    assert local_file.is_authorized is True
    assert oauth_only.is_authorized is False
    provider_instance.get_datasource_credentials.assert_called_once_with(
        tenant_id="tenant-1", provider="notion", plugin_id="plugin-1"
    )
