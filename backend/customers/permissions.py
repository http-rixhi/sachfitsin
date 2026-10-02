from rest_framework.permissions import BasePermission
from accounts.models import User


class IsCustomer(BasePermission):
    message = "Only customers can access this endpoint."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.CUSTOMER
        )


class IsDietician(BasePermission):
    message = "Only dieticians can access this endpoint."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.DIETICIAN
        )