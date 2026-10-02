from rest_framework.permissions import BasePermission

from accounts.models import User


class IsCustomer(BasePermission):
    message = "Only customers can make payments."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.CUSTOMER
        )
